import * as vscode from "vscode";
import type MarkdownIt from 'markdown-it';
import {
  applyEmbeddedDiagramTokenHighlighting,
  configSection,
  findEmbeddedDiagramTokensFromAuxFiles,
  getDiagramTemplates,
  getHelpUrl,
  isAuxFile,
  EmbeddedDiagramToken,
  syncAuxFile,
  triggerSuggestIfEmpty,
} from "./util";
import { EmbeddedDiagramCodeLensProvider } from "./embeddedDiagramCodeLensProvider";
import { createMermaidFile, getPreview } from "./commands/createFile";
import { handleTextDocumentChange } from "./eventHandlers";
import { getSnippetsBasedOnDiagram } from "./constants/condSnippets";
import { getFirstWordFromDiagram, normalizeMermaidText } from "./frontmatter";
import { injectMermaidTheme } from "./previewmarkdown/themeing";
import { extendMarkdownItWithMermaid } from "./previewmarkdown/shared-md-mermaid";
import { clearTmLanguageCache } from "./syntaxHighlighter";

let diagramMappings: { [key: string]: string[] } = require('../src/diagramTypeWords.json');
let isExtensionStarted = false;

export async function activate(context: vscode.ExtensionContext) {
  let codeLensProvider: EmbeddedDiagramCodeLensProvider | undefined;

  context.subscriptions.push(
    vscode.commands.registerCommand("pelePreview.preview", () => getPreview()),
  );

  const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && !isExtensionStarted) {
        isExtensionStarted = true;
        handleTextDocumentChange(activeEditor, diagramMappings, true);
    }

  vscode.workspace.onDidChangeTextDocument((event) =>
    {
      handleTextDocumentChange(event, diagramMappings, false);
      updateEmbeddedDiagramTokenHighlighting();
      triggerSuggestIfEmpty(event.document);
    },
    null,
    context.subscriptions
  );

  vscode.window.onDidChangeActiveTextEditor(
    (event) => {
      handleTextDocumentChange(event, diagramMappings, true);
      updateEmbeddedDiagramTokenHighlighting();
    },
    null,
    context.subscriptions
  );

  const embeddedDiagramGutterIconDecoration = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.file(context.asAbsolutePath("images/mermaid-icon.svg")),
    gutterIconSize: "8x8",
  });

  function updateEmbeddedDiagramTokenHighlighting() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    const embeddedDiagramTokens: EmbeddedDiagramToken[] = isAuxFile(activeEditor.document.fileName)
      ? findEmbeddedDiagramTokensFromAuxFiles(activeEditor.document)
      : [];

    applyEmbeddedDiagramTokenHighlighting(
      activeEditor,
      embeddedDiagramTokens,
      embeddedDiagramGutterIconDecoration
    );

    if (codeLensProvider) {
      codeLensProvider.setEmbeddedDiagramTokens(embeddedDiagramTokens);
    } else {
      codeLensProvider = new EmbeddedDiagramCodeLensProvider(embeddedDiagramTokens);
      context.subscriptions.push(
        vscode.languages.registerCodeLensProvider("*", codeLensProvider)
      );
    }
  }

  updateEmbeddedDiagramTokenHighlighting();

  context.subscriptions.push(
    vscode.commands.registerCommand("pelePreview.createDiagram", () => createMermaidFile(null))
  );

context.subscriptions.push(
  vscode.commands.registerCommand('pelePreview.editEmbeddedDiagram', async (uri: vscode.Uri, range: vscode.Range) => {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const content = document.getText();
      const blockContent = content.substring(document.offsetAt(range.start), document.offsetAt(range.end));
      const normalizedContent = normalizeMermaidText(blockContent);
      
      if (!normalizedContent) {
        vscode.window.showErrorMessage("No valid Mermaid diagram found in the selected range.");
        return;
      }
      
      const editor = await createMermaidFile(normalizedContent);
      if (editor) {
        syncAuxFile(editor.document.uri.toString(), uri, range);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error processing Mermaid diagram: ${error instanceof Error ? error.message : "Unknown error occurred."}`);
    }
  })
);

  context.subscriptions.push(
    vscode.commands.registerCommand("pelePreview.diagramHelp", async() => {
      const activeEditor = await vscode.window.activeTextEditor;
      let helpUrl = 'https://mermaid.js.org/intro/';
      
      if (activeEditor) {
        if (activeEditor.document.languageId.includes('mermaid')) {
          const documentText = activeEditor.document.getText();
          const firstWord = getFirstWordFromDiagram(documentText);
          if (firstWord) {
            let foundDiagramType = '';
            const firstWordLower = firstWord.toLowerCase();
            for (const [diagramType, aliases] of Object.entries(diagramMappings)) {
              if (aliases.some(alias => alias.toLowerCase() === firstWordLower)) {
                foundDiagramType = firstWord;
                break;
              }
            }
            if (foundDiagramType) {
              helpUrl = getHelpUrl(foundDiagramType);
            }
          }
        }
      }
      vscode.env.openExternal(vscode.Uri.parse(helpUrl));
    })
  );

  const provider = vscode.languages.registerCompletionItemProvider(
    [
      { scheme: 'file' },
      { scheme: 'untitled' }
    ],
    {
        provideCompletionItems(document, position, token, context) {
            const languageId = document.languageId.toLowerCase();
            if (document.getText().trim() === "") {
              return;
            }
            // Ensure the languageId is exactly "mermaid" or starts with "mermaid"
            if (!(languageId === 'mermaid' || languageId.startsWith('mermaid'))) {
                return [];
            }

            const snippets = getSnippetsBasedOnDiagram(languageId);

            const suggestions: vscode.CompletionItem[] = snippets.map(snippet => {
                const item = new vscode.CompletionItem(
                    snippet.id,
                    vscode.CompletionItemKind.Snippet
                );
                item.insertText = new vscode.SnippetString(snippet.completion);
                item.documentation = new vscode.MarkdownString(
                    `**${snippet.name}**\n\n\`\`\`mermaid\n${snippet.sample}\n\`\`\``
                );
                return item;
            });

            return suggestions;
        },
    },
    'm'
  );
  context.subscriptions.push(provider);

context.subscriptions.push(
  vscode.languages.registerCompletionItemProvider(
    [
      { scheme: 'file' },
      { scheme: 'untitled' }
    ],
    {
      provideCompletionItems(document) {
        if (document.getText().trim() === "") {
          const templates = getDiagramTemplates();
          const templateEntries = Object.entries(templates);

          const suggestions = templateEntries.map(([name, code]) => {
            const item = new vscode.CompletionItem(
              name,
              vscode.CompletionItemKind.Snippet
            );
            item.insertText = new vscode.SnippetString(code);
            item.documentation = new vscode.MarkdownString(
              `**${name}**\n\n\`\`\`mermaid\n${code}\n\`\`\``
            );
            return item;
          });
          return suggestions;
        }
        return [];
      },
    },
  )
);
vscode.workspace.onDidOpenTextDocument((document) => {
  triggerSuggestIfEmpty(document);
});
vscode.window.visibleTextEditors.forEach((editor) => {
  triggerSuggestIfEmpty(editor.document);
});

// Register markdown preview handler
context.subscriptions.push(
  vscode.workspace.onDidOpenTextDocument((document) => {
    if (document.languageId === 'markdown') {
      const content = document.getText();
      if (content.includes('```mermaid')) {
        // This will ensure our custom preview script is loaded
        vscode.commands.executeCommand('markdown.preview.refresh');
      }
    }
  })
);
context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
  if (e.affectsConfiguration(configSection) || e.affectsConfiguration('workbench.colorTheme')) {
      vscode.commands.executeCommand('markdown.preview.refresh');
  }
}));

return {
  extendMarkdownIt(md: MarkdownIt) {
      extendMarkdownItWithMermaid(md, {
          languageIds: () => {
              return vscode.workspace.getConfiguration(configSection).get<string[]>('languages', ['mermaid']);
          }
      });
      md.use(injectMermaidTheme);
      return md;
  }
};
}

// This method is called when your extension is deactivated
export function deactivate() {
  clearTmLanguageCache();
}
