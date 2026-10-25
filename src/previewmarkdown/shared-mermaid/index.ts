import { mermaidPreviewContainerSelector } from '../shared-md-mermaid';
import { applyPeleTheme, renderPele } from '../../renderers/pele';

const sources = new WeakMap<HTMLElement, { source: string; output: string }>();

export function renderMermaidBlocksInElement(root: HTMLElement, maxTextSize = 90000, maxEdges = 1000): void {
    const dark = document.body.classList.contains('vscode-dark') ||
        document.body.classList.contains('vscode-high-contrast');
    for (const container of Array.from(root.querySelectorAll<HTMLElement>(mermaidPreviewContainerSelector))) {
        const previous = sources.get(container);
        const source = previous?.output === container.innerHTML
            ? previous.source : container.textContent ?? '';
        try {
            const result = renderPele(source, `mermaid-${crypto.randomUUID()}`, maxTextSize, maxEdges);
            container.innerHTML = result.svg;
            applyPeleTheme(container, dark);
        } catch (error) {
            const message = document.createElement('pre');
            message.className = 'mermaid-error';
            message.textContent = error instanceof Error ? error.message : String(error);
            container.replaceChildren(message);
        }
        sources.set(container, { source, output: container.innerHTML });
    }
}
