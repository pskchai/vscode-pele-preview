import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { getIconData, iconToSVG } from '@iconify/utils';

const require = createRequire(import.meta.url);
const packs = {};

function prepare(svg) {
    return svg.replace(/<svg\b([^>]*)>/, (_match, attributes) => {
        attributes = attributes.replace(/\s(?:width|height)="[^"]*"/g, '');
        if (!/\sfill=/.test(attributes)) attributes += ' fill="currentColor"';
        if (!/\sstroke=/.test(attributes)) attributes += ' stroke="none"';
        return `<svg${attributes} width="100%" height="100%">`;
    });
}

const fontAwesome = require('@fortawesome/fontawesome-free/metadata/icon-families.json');
for (const [style, prefix] of Object.entries({ solid: 'fas', regular: 'far', brands: 'fab' })) {
    const icons = packs[prefix] = {};
    for (const [name, icon] of Object.entries(fontAwesome)) {
        const svg = icon.svgs?.classic?.[style]?.raw;
        if (!svg) continue;
        icons[name] = prepare(svg);
        for (const alias of icon.aliases?.names ?? []) icons[alias] = icons[name];
    }
}

for (const prefix of ['fa6-regular', 'logos', 'mdi']) {
    const collection = require(`@iconify-json/${prefix}/icons.json`);
    const icons = packs[prefix] = {};
    for (const name of [...Object.keys(collection.icons), ...Object.keys(collection.aliases ?? {})]) {
        const icon = getIconData(collection, name);
        if (!icon) continue;
        const { body, attributes } = iconToSVG(icon);
        icons[name] = prepare(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${attributes.viewBox}">${body}</svg>`);
    }
}

// Build cloud packs from the saved provider SVGs and aliases.
for (const prefix of ['aws', 'azure', 'gcp']) {
    const pack = packs[prefix] = {};
    const source = new URL(`../assets/cloud-icons/${prefix}.json`, import.meta.url);
    const { icons, aliases } = JSON.parse(await readFile(source, 'utf8'));
    for (const [name, svg] of Object.entries(icons)) {
        pack[name] = prepare(svg);
    }
    for (const [name, target] of Object.entries(aliases)) {
        pack[name] = pack[target];
    }
}

const output = fileURLToPath(new URL('../src/renderers/icon-packs.generated.json', import.meta.url));
await writeFile(output, JSON.stringify(packs));
console.log(`Built ${Object.values(packs).reduce((total, icons) => total + Object.keys(icons).length, 0)} local icons.`);
