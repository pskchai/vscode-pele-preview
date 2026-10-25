import * as vscode from "vscode";
import { debounce } from "../utils/debounce";
import { getWebviewHTML } from "../templates/previewTemplate";
import * as packageJson from "../../package.json";
import { saveDiagramAsPng, saveDiagramAsSvg } from "../services/renderService";
const MAX_ZOOM = "pelePreview.maxZoom";
const MAX_CHAR_LENGTH = "pelePreview.maxTextSize";
const MAX_EDGES = "pelePreview.maxEdges";

export class PreviewPanel {
  private static currentPanel: PreviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private document: vscode.TextDocument;
  private readonly disposables: vscode.Disposable[] = [];
  private isFileChange = false;
  private readonly diagnosticsCollection: vscode.DiagnosticCollection;
  private lastContent: string = "";
  private constructor(
    panel: vscode.WebviewPanel,
    document: vscode.TextDocument
  ) {
    this.panel = panel;
    this.document = document;
    this.diagnosticsCollection = vscode.languages.createDiagnosticCollection("pelePreview");


    this.update();
    this.setupListeners();
  }

  public static createOrShow(document: vscode.TextDocument) {
    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel.document = document;
      PreviewPanel.currentPanel.isFileChange = true;
      PreviewPanel.currentPanel.update();
      PreviewPanel.currentPanel.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "pelePreview",
      "Pele Preview",
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );
    PreviewPanel.currentPanel = new PreviewPanel(panel, document);
  }

  private update() {
    const extensionPath = vscode.extensions.getExtension(`${packageJson.publisher}.${packageJson.name}`)?.extensionPath;
    
    if (!extensionPath) {
      throw new Error("Unable to resolve the extension path");
    }
  
    // Get the current active theme (dark or light)
    const isDarkTheme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ||
      vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast;

    // Fetch the configuration from VSCode workspace
    const config = vscode.workspace.getConfiguration();

    // Read the preview limits.
    const maxZoom = config.get<number>(MAX_ZOOM, 5);
    const maxCharLength = config.get<number>(MAX_CHAR_LENGTH, 90000);
    const maxEdges = config.get<number>(MAX_EDGES, 1000);

    // Match the active VS Code color theme.
    const currentTheme = isDarkTheme ? 'dark' : 'default';
      this.lastContent = this.document.getText() || " ";

  
    if (!this.panel.webview.html) {
      this.panel.webview.html = getWebviewHTML(this.panel, extensionPath, this.lastContent, currentTheme, maxZoom, maxCharLength, maxEdges);
    }
    this.panel.webview.postMessage({
      type: "update",
      content:this.lastContent,
      currentTheme: currentTheme,
      isFileChange: this.isFileChange,
      maxZoom: maxZoom,
      maxCharLength: maxCharLength,
      maxEdge: maxEdges,
    });
    this.isFileChange = false;
  }

  private setupListeners() {
    const debouncedUpdate = debounce(() => this.update(), 300);
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('pelePreview', this.document.uri)) {
        this.update();
      }
    }, null, this.disposables);
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === this.document) {
        debouncedUpdate();
      }
    }, this.disposables);

    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document?.languageId.startsWith('mermaid')) {
        if (editor.document.uri.toString() !== this.document?.uri.toString()) {
          this.document = editor.document; 
          this.isFileChange = true; 
          debouncedUpdate();
        }
      } 
    }, this.disposables);

    vscode.window.onDidChangeActiveColorTheme(() => {
      this.update(); 
  }, this.disposables);

  this.panel.webview.onDidReceiveMessage(async (message) => {
    if (message.type === "error" && message.message) {
      this.handleDiagramError(message.message, message.line, message.column);
    } else if (message.type === "clearError") {
      this.diagnosticsCollection.clear();
    } else if (message.type === "exportPng" && message.pngBase64) {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Exporting PNG...",
        cancellable: false
      }, async () => {
        await saveDiagramAsPng(this.document, message.pngBase64);
      });
    } else if (message.type === "exportSvg" && message.svgBase64) {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Exporting SVG...",
        cancellable: false
      }, async () => {
        await saveDiagramAsSvg(this.document, message.svgBase64);
      });
    }
  });

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private handleDiagramError(errorMessage: string, line?: number, column?: number) {

    const diagnostics: vscode.Diagnostic[] = [];
    if (line && line > 0) {
      const lineIndex = Math.min(line - 1, this.document.lineCount - 1);
      const character = Math.min(Math.max((column ?? 1) - 1, 0), this.document.lineAt(lineIndex).text.length);
      const range = new vscode.Range(lineIndex, character, lineIndex, character);
      diagnostics.push(new vscode.Diagnostic(range, errorMessage, vscode.DiagnosticSeverity.Error));
    }
  
    this.diagnosticsCollection.clear();
    this.diagnosticsCollection.set(this.document.uri, diagnostics);
  }
  
  public dispose() {
    PreviewPanel.currentPanel = undefined;
    this.diagnosticsCollection.clear();
    this.diagnosticsCollection.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
