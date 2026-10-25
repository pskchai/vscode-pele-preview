import * as vscode from "vscode";
import { EmbeddedDiagramToken } from "./util";

export class EmbeddedDiagramCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(private embeddedDiagramTokens: EmbeddedDiagramToken[]) {}

  setEmbeddedDiagramTokens(embeddedDiagramTokens: EmbeddedDiagramToken[]) {
    this.embeddedDiagramTokens = embeddedDiagramTokens;
    this._onDidChangeCodeLenses.fire();
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): Promise<vscode.CodeLens[]> {
    if (document.languageId.startsWith("mermaid")) {
      return [];
    }

    return this.embeddedDiagramTokens.map(
      (token) =>
        new vscode.CodeLens(token.range, {
          title: "Edit Diagram",
          command: "pelePreview.editEmbeddedDiagram",
          arguments: [token.uri, token.range],
        }),
    );
  }
}
