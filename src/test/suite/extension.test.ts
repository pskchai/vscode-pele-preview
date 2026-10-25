import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Pele Preview', () => {
  let extension: vscode.Extension<unknown>;

  suiteSetup(async () => {
    const installed = vscode.extensions.getExtension('pskchai.vscode-pele-preview');
    assert.ok(installed, 'The fork must have its own extension ID.');
    extension = installed;
    await extension.activate();
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('contributes the preview toolbar action and no sidebar or cloud commands', async () => {
    const manifest = extension.packageJSON;
    assert.strictEqual(manifest.version, '1.0.0');
    assert.strictEqual(manifest.contributes.views, undefined);
    assert.strictEqual(manifest.contributes.viewsContainers, undefined);
    const action = manifest.contributes.menus['editor/title'][0];
    assert.strictEqual(action.command, 'pelePreview.preview');
    assert.strictEqual(action.group, 'navigation@1');
    assert.ok(action.when.includes('mmd|mermaid'));
    assert.ok(action.when.includes('resourceLangId'));
    assert.deepStrictEqual(Object.keys(manifest.contributes.configuration.properties).sort(), [
      'pelePreview.maxEdges', 'pelePreview.maxTextSize', 'pelePreview.maxZoom'
    ]);
    const commands = await vscode.commands.getCommands(true);
    assert.deepStrictEqual(commands.filter(command => command.startsWith('pelePreview.')).sort(), [
      'pelePreview.createDiagram', 'pelePreview.diagramHelp',
      'pelePreview.editEmbeddedDiagram', 'pelePreview.preview'
    ]);
    assert.ok(manifest.contributes.commands.every((command: { command: string }) => commands.includes(command.command)));
  });

  test('opens Preview Diagram from a Mermaid editor', async () => {
    const document = await vscode.workspace.openTextDocument({
      language: 'mermaid', content: 'flowchart LR\n A[Source] --> B[Preview]'
    });
    await vscode.window.showTextDocument(document);
    await vscode.commands.executeCommand('pelePreview.preview');
    await waitForPreviewTab();
    const previewTabs = vscode.window.tabGroups.all.flatMap(group => group.tabs)
      .filter(tab => tab.input instanceof vscode.TabInputWebview && tab.label === 'Pele Preview');
    assert.strictEqual(previewTabs.length, 1);
  });

  test('creates a local diagram and opens its preview', async () => {
    await vscode.commands.executeCommand('pelePreview.createDiagram');
    await waitForPreviewTab();
    assert.ok(vscode.workspace.textDocuments.some(document =>
      document.isUntitled && document.getText().includes('A[Write Mermaid source]')));
    assert.ok(vscode.window.tabGroups.all.some(group => group.tabs.some(tab =>
      tab.input instanceof vscode.TabInputWebview && tab.label === 'Pele Preview')));
  });
});

function waitForPreviewTab(): Promise<void> {
  const isOpen = () => vscode.window.tabGroups.all.some(group => group.tabs.some(tab =>
    tab.input instanceof vscode.TabInputWebview && tab.label === 'Pele Preview'));
  if (isOpen()) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const listener = vscode.window.tabGroups.onDidChangeTabs(() => {
      if (isOpen()) {
        clearTimeout(timeout);
        listener.dispose();
        resolve();
      }
    });
    const timeout = setTimeout(() => {
      listener.dispose();
      reject(new Error('The preview tab did not open.'));
    }, 1500);
  });
}
