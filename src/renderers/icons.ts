import { replaceIDs } from '@iconify/utils/lib/svg/id';
import generated from './icon-packs.generated.json';

const packs: Record<string, Record<string, string>> = generated;

export function createIconResolver(diagramId: string) {
    let nextId = 0;
    return (name: string): string | undefined => {
        const normalized = name.replace(/^(fa[brs]?)\s+(fa-[\w-]+)$/, '$1:$2');
        const match = /^([a-z0-9-]+):([a-zA-Z0-9_-]+)$/.exec(normalized);
        if (!match) {
            return undefined;
        }
        let [, prefix, key] = match;
        if (['fa', 'fas', 'far', 'fab', 'fa6-regular'].includes(prefix)) {
            if (prefix === 'fa') {
                prefix = key.startsWith('fa-') ? 'fas' : 'fa6-regular';
            }
            key = key.replace(/^fa-/, '');
        }
        if (prefix === 'aws' && key === 's3') {
            key = 'simple-storage-service';
        }
        if (prefix === 'azure' && key === 'virtual-machines') {
            key = 'virtual-machine';
        }
        const svg = packs[prefix]?.[key] ?? (prefix === 'fa6-regular' ? packs.fas[key] : undefined);
        // Return only bundled SVG data. Never insert a name from the source into SVG markup.
        return typeof svg === 'string' ? replaceIDs(svg, () => `${diagramId}-icon-${nextId++}`) : undefined;
    };
}
