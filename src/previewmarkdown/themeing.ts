import type MarkdownIt from 'markdown-it';
import * as vscode from 'vscode';
import { configSection } from '../util';
import { prepareMermaidPreviewHtml } from './shared-md-mermaid';

export function injectMermaidTheme(md: MarkdownIt) {
    const render = md.renderer.render;

    md.renderer.render = function (...args) {
        const config = vscode.workspace.getConfiguration(configSection);
        const maxTextSize = config.get<number>('maxTextSize', 90000);
        const maxEdges = config.get<number>('maxEdges', 1000);
        const html = `<span id="markdown-mermaid" aria-hidden="true"
                    data-max-edges="${maxEdges}"
                    data-max-text-size="${maxTextSize}"></span>
                ${render.apply(md.renderer, args)}`;
        return prepareMermaidPreviewHtml(html);
    };

    return md;
}
