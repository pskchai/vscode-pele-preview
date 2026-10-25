import { renderMermaidBlocksInElement } from '../shared-mermaid';

function init() {
    const config = document.getElementById('markdown-mermaid');
    renderMermaidBlocksInElement(
        document.body,
        Number(config?.dataset.maxTextSize) || 90000,
        Number(config?.dataset.maxEdges) || 1000,
    );
}

window.addEventListener('vscode.markdown.updateContent', init);
new MutationObserver(init).observe(document.body, { attributes: true, attributeFilter: ['class'] });
init();
