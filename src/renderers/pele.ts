import { parse, render, type RenderOptions } from 'pele';
import { createIconResolver } from './icons';

export { PeleError } from 'pele';

export function validatePele(source: string, maxTextSize: number, maxEdges: number) {
    return parse(source, { limit: maxTextSize, maxEdges });
}

export function renderPele(source: string, id: string, maxTextSize: number, maxEdges: number) {
    const options: RenderOptions = {
        idPrefix: id,
        limit: maxTextSize,
        maxEdges,
        icons: createIconResolver(id),
    };
    return render(source, options);
}

export function applyPeleTheme(container: HTMLElement, dark: boolean): void {
    const svg = container.querySelector<SVGSVGElement>('svg.pele');
    if (!svg) {
        return;
    }
    // Store colors in the SVG so exported images keep the preview colors.
    const colors = [
        ['bg', dark ? '#1e1e1e' : '#ffffff'],
        ['fg', dark ? '#e6e6e6' : '#1f1f1f'],
        ['muted', dark ? '#aaaaaa' : '#6e6e6e'],
        ['line', dark ? '#e6e6e6' : '#1f1f1f'],
        ['surface', dark ? '#2d2d2d' : '#f3f3f3'],
        ['surface-alt', dark ? '#383838' : '#e6e6e6'],
        ['border', dark ? '#888888' : '#8a8a8a'],
        ['accent', dark ? '#8ca9ff' : '#5b7bd5'],
    ];
    for (const [name, color] of colors) {
        svg.style.setProperty(`--pele-${name}`, color);
    }
}
