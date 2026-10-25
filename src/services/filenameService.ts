import * as vscode from 'vscode';
import path from 'path';

export function getDefaultSaveUri(document: vscode.TextDocument, extension: string): vscode.Uri | undefined {
    const baseName = path.basename(document.fileName, path.extname(document.fileName)) || 'diagram';
    if (document.uri.scheme === 'file') {
        return vscode.Uri.joinPath(document.uri, `../${baseName}.${extension}`);
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    return folder ? vscode.Uri.joinPath(folder.uri, `${baseName}.${extension}`) : undefined;
}
