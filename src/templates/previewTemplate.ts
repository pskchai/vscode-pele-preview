import * as vscode from "vscode";
import * as path from "path";

export function getWebviewHTML(panel: vscode.WebviewPanel, extensionPath: string, initialContent: string, currentTheme:string, maxZoom = 5, maxTextSize = 90000, maxEdges = 1000): string {
  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionPath, "out", "svelte", "bundle.js"))
  );
  const fontUrl = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionPath, "media", "recursive-latin-full-normal.woff2"))
  );

  return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pele Preview</title>
      <script type="module" src="${scriptUri}"></script>
      <style>
        @font-face {
          font-family: "Recursive";
          src: url("${fontUrl}") format("woff2");
          font-weight: 300 900;
          font-style: normal;
        }
        #app {
          height: 100vh;
        }
        body {
          font-family: "Recursive", serif;
        }
      </style>
    </head>
    <body>
      <div id="app" data-initial-content="${encodeURIComponent(initialContent)}" data-current-theme="${encodeURIComponent(currentTheme)}"
        data-max-zoom="${maxZoom}" data-max-text-size="${maxTextSize}" data-max-edges="${maxEdges}"></div>
    </body>
    </html>
  `;
}
