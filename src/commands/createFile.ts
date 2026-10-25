import * as vscode from "vscode";
import { PreviewPanel } from "../panels/previewPanel";
export async function createMermaidFile(
  diagramContent: string | null
): Promise<vscode.TextEditor | null> {
  const exampleContent = `flowchart TD
    A[Write Mermaid source] --> B[Preview Diagram]
    B --> C[Export SVG or PNG]`;

  try {
    const document = await vscode.workspace.openTextDocument({
      language: "mermaid",
      content: diagramContent ?? exampleContent
    });

    const editor = await vscode.window.showTextDocument(document);
    if (!editor?.document) {
      return null;
    }

    PreviewPanel.createOrShow(editor.document);
    return editor;
  } catch (error) {
    console.error("Error creating Mermaid file:", error);
    return null;
  }
}

export function getPreview() {
  const activeEditor = vscode.window.activeTextEditor;
  
  if (!activeEditor) {
    vscode.window.showErrorMessage("No active editor. Open a .mmd file to preview.");
    return;
  }

  const document = activeEditor.document;
  if (document.languageId !== "plaintext" && 
      !document.fileName.endsWith(".mmd") && 
      !document.fileName.endsWith(".mermaid") && 
      !document.languageId.startsWith('mermaid')) {
    vscode.window.showErrorMessage("Pele Preview requires a Mermaid file.");
    return;
  }
  PreviewPanel.createOrShow(document);
}
