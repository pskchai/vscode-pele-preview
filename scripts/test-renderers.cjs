const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { build } = require('esbuild');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');

async function run() {
    const manifest = require('../package.json');
    assert.ok(manifest.dependencies.pele);
    assert.ok(!Object.keys(manifest.dependencies).some(name => name.startsWith('@mermaid-chart/')));

    const { outputFiles } = await build({
        stdin: {
            contents: `export * from './src/renderers/pele';
                export * from './src/renderers/icons';
                export * from './webview/src/services/exportService';`,
            resolveDir: root,
            loader: 'ts',
        },
        bundle: true,
        write: false,
        format: 'iife',
        globalName: 'previewTest',
    });
    const server = http.createServer((_request, response) => response.end('<!doctype html><body></body>'));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        });
        async function pageWith(html) {
            const page = await browser.newPage();
            await page.goto(`http://127.0.0.1:${server.address().port}`);
            await page.setContent(html);
            await page.evaluate(() => {
                window.messages = [];
                window.acquireVsCodeApi = () => ({ postMessage: message => window.messages.push(message) });
            });
            return page;
        }

        const page = await pageWith('<div id="mermaid-diagram"></div>');
        await page.addScriptTag({ content: outputFiles[0].text });
        const types = await page.evaluate(() => [
            'flowchart LR\n A[Start] --> B[End]',
            'sequenceDiagram\n Alice->>Bob: Hello',
            'classDiagram\n Animal <|-- Duck',
            'stateDiagram-v2\n [*] --> Ready',
            'erDiagram\n CUSTOMER ||--o{ ORDER : places',
        ].map((source, index) => {
            const result = previewTest.renderPele(source, `test-${index}`, 90000, 1000);
            const container = document.getElementById('mermaid-diagram');
            container.innerHTML = result.svg;
            return { type: result.type, nodes: container.querySelectorAll('svg *').length };
        }));
        assert.deepEqual(types.map(result => result.type), ['flowchart', 'sequence', 'class', 'state', 'er']);
        assert.ok(types.every(result => result.nodes > 0));
        const errors = await page.evaluate(() => [
            ['not a diagram', 90000, 1000],
            ['flowchart LR\n A --> B', 5, 1000],
            ['flowchart LR\n A --> B --> C', 90000, 1],
        ].map(([source, limit, edges]) => {
            try {
                previewTest.validatePele(source, limit, edges);
                return null;
            } catch (error) {
                return error.code;
            }
        }));
        assert.deepEqual(errors, ['unsupported-diagram', 'limit', 'limit']);

        await page.setOfflineMode(true);
        const iconNames = ['fa:fa-book', 'fas:fa-house', 'far:fa-address-book', 'fab:fa-youtube',
            'fa:gem', 'fas:fa-home', 'logos:github-icon', 'mdi:account', 'aws:ec2', 'aws:s3',
            'aws:res-amazon-simple-storage-service-s3-standard', 'aws:res-amazon-simple-storage-service-bucket', 'aws:arch-amazon-ec2',
            'aws:lambda-lambda-function', 'azure:virtual-machine', 'azure:virtual-machines',
            'azure:10245-icon-service-key-vaults', 'azure:038470534-icon-service-foundry-control-plane',
            'gcp:compute-engine', 'gcp:cloud-storage', 'gcp:category-ai-machine-learning'];
        const iconResults = await page.evaluate(names => names.map((name, index) => {
            const container = document.getElementById('mermaid-diagram');
            container.innerHTML = previewTest.renderPele(`flowchart LR\n A@{icon: "${name}", label: "Icon"}`, `icons-${index}`, 90000, 1000).svg;
            const icon = container.querySelector('.pele-icon svg');
            return { name, paths: icon?.querySelectorAll('path').length ?? 0, width: icon?.getBoundingClientRect().width ?? 0 };
        }), iconNames);
        assert.ok(iconResults.every(icon => icon.paths > 0 && icon.width > 0), JSON.stringify(iconResults));
        const providerStyles = await page.evaluate(() => {
            const container = document.getElementById('mermaid-diagram');
            const names = ['gcp:cloud-storage', 'gcp:compute-engine', 'gcp:vertex-ai',
                'azure:10245-icon-service-key-vaults', 'azure:10245-icon-service-key-vaults'];
            const nodes = names.map((name, index) => ` N${index}@{icon: "${name}", label: "Icon"}`);
            container.innerHTML = previewTest.renderPele(`flowchart LR\n${nodes.join('\n')}`, 'provider-styles', 90000, 1000).svg;
            const ids = [...container.querySelectorAll('[id]')].map(element => element.id);
            return {
                icons: container.querySelectorAll('.pele-icon svg').length,
                styles: container.querySelectorAll('.pele-icon style').length,
                ids: ids.length,
                uniqueIds: new Set(ids).size,
            };
        });
        assert.equal(providerStyles.icons, 5);
        assert.equal(providerStyles.styles, 0, 'Provider CSS must not change other icons.');
        assert.equal(providerStyles.ids, providerStyles.uniqueIds, 'SVG IDs must be unique.');
        assert.deepEqual(await page.evaluate(() => {
            const resolve = previewTest.createIconResolver('unknown');
            return ['fas:not-an-icon', 'logos:__proto__', 'constructor:toString', 'fa:<script>'].map(name => resolve(name) ?? null);
        }), [null, null, null, null]);
        const labelIcons = await page.evaluate(() => {
            const container = document.getElementById('mermaid-diagram');
            container.innerHTML = previewTest.renderPele('flowchart LR\n A["fa:fa-book Read"] --> B["fab:fa-youtube Watch"]', 'inline', 90000, 1000).svg;
            return { icons: container.querySelectorAll('.pele-icon svg path').length, text: container.textContent };
        });
        assert.equal(labelIcons.icons, 2);
        assert.ok(labelIcons.text.includes('Read') && !labelIcons.text.includes('fa:'));
        assert.ok(await page.evaluate(() => {
            const svg = previewTest.renderPele('mindmap\n root((Root))\n  Child\n   ::icon(fa fa-book)', 'mindmap-icons', 90000, 1000).svg;
            return svg.includes('data-icon="fa fa-book"') && svg.includes('<path');
        }));
        const cloudDiagram = 'architecture-beta\n service a(aws:ec2)[EC2]\n service b(azure:virtual-machine)[VM]\n service c(gcp:compute-engine)[Compute]\n a:R --> L:b\n b:R --> L:c';
        const s3Diagram = 'flowchart LR\n img_s3@{ icon: "aws:res-amazon-simple-storage-service-s3-standard" }';
        for (const [source, expectedIcons] of [[cloudDiagram, 3], [s3Diagram, 1]]) {
            const iconExport = await page.evaluate(async source => {
                const container = document.getElementById('mermaid-diagram');
                container.innerHTML = previewTest.renderPele(source, 'cloud-export', 90000, 1000).svg;
                const encoded = await previewTest.getBase64SVG(container.querySelector('svg'));
                const image = new Image();
                image.src = `data:image/svg+xml;base64,${encoded}`;
                await image.decode();
                const canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0);
                const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
                let colored = 0;
                for (let i = 0; i < pixels.length; i += 4) {
                    if (pixels[i + 3] > 0 && Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) > 40) colored++;
                }
                return { icons: container.querySelectorAll('.pele-icon svg').length, colored, svg: atob(encoded) };
            }, source);
            assert.equal(iconExport.icons, expectedIcons);
            assert.ok(iconExport.colored > 20, 'Exported cloud icons must retain their colors.');
            assert.ok(!iconExport.svg.includes('foreignObject'));
        }
        await page.evaluate(() => previewTest.exportPng());
        await page.waitForFunction(() => window.messages.some(message => message.type === 'exportPng'));
        console.log('Font Awesome, Iconify, cloud icons, and offline icon export passed.');
        for (const dark of [false, true]) {
            const exported = await page.evaluate(async dark => {
                const container = document.getElementById('mermaid-diagram');
                container.innerHTML = previewTest.renderPele('flowchart LR\n A[Start] --> B[End]', 'export', 90000, 1000).svg;
                previewTest.applyPeleTheme(container, dark);
                const svg = container.querySelector('svg');
                const encoded = await previewTest.getBase64SVG(svg);
                const image = new Image();
                image.src = `data:image/svg+xml;base64,${encoded}`;
                await image.decode();
                const canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0);
                return {
                    svg: atob(encoded),
                    visible: context.getImageData(0, 0, canvas.width, canvas.height).data.some(value => value > 0),
                };
            }, dark);
            assert.ok(exported.visible);
            assert.ok(exported.svg.includes(`--pele-bg: ${dark ? '#1e1e1e' : '#ffffff'}`));
        }
        await page.evaluate(() => previewTest.exportPng('dark'));
        await page.waitForFunction(() => window.messages.some(message => message.type === 'exportPng'));
        assert.equal(await page.evaluate(() => window.messages.find(message => message.type === 'exportPng').pngBase64.slice(0, 8)), 'iVBORw0K');
        await page.close();
        console.log('Pele rendering, limits, themes, and offline SVG/PNG export passed.');

        const panelScript = await fs.readFile(path.join(root, 'out/svelte/bundle.js'), 'utf8');
        const panel = await pageWith(`<div id="app" data-initial-content="${encodeURIComponent('flowchart LR\n A[Panel] --> B[Ready]')}" data-current-theme="default"></div>`);
        await panel.addScriptTag({ content: panelScript });
        await panel.waitForSelector('#mermaid-diagram svg.pele');
        async function updatePanel(content = 'flowchart LR\n A[Changed] --> B[Ready]', maxCharLength = 90000) {
            await panel.evaluate(({ content, maxCharLength }) => window.postMessage({
                type: 'update', content, currentTheme: 'dark',
                maxZoom: 5, maxCharLength, maxEdge: 1000,
            }), { content, maxCharLength });
        }
        await updatePanel();
        await panel.waitForFunction(() => document.querySelector('#mermaid-diagram svg')?.textContent.includes('Changed'));
        assert.equal(await panel.$eval('#mermaid-diagram svg', svg => svg.style.getPropertyValue('--pele-bg')), '#1e1e1e');
        await updatePanel('flowchart LR\n A -->');
        await panel.waitForFunction(() => window.messages.some(message => message.type === 'error'));
        assert.ok(await panel.evaluate(() => window.messages.find(message => message.type === 'error').line > 0));
        await updatePanel();
        await panel.waitForSelector('#mermaid-diagram svg.pele');
        await panel.waitForFunction(() => window.messages.some(message => message.type === 'clearError'));
        await panel.evaluate(() => { window.messages = []; });
        await updatePanel(undefined, 5);
        await panel.waitForFunction(() => window.messages.some(message => message.type === 'error' && message.message.includes('limit')));
        await updatePanel();
        await panel.waitForSelector('#mermaid-diagram svg.pele');
        await panel.click('[aria-label="Zoom In"]');
        await panel.waitForFunction(() => !document.querySelector('.zoom-level').textContent.includes('100%'));
        await updatePanel(s3Diagram);
        await panel.waitForSelector('#mermaid-diagram [data-icon="aws:res-amazon-simple-storage-service-s3-standard"] svg path');
        assert.ok(await panel.$eval('#mermaid-diagram .pele-icon', icon => icon.textContent.includes('S3-Standard')));
        await updatePanel(cloudDiagram);
        await panel.waitForFunction(() => document.querySelectorAll('#mermaid-diagram .pele-icon svg').length === 3);
        await panel.close();

        const markdownScript = await fs.readFile(path.join(root, 'dist-preview/bundle.js'), 'utf8');
        const markdown = await pageWith(`<span id="markdown-mermaid"></span>
            <div class="mermaid-preview">flowchart LR\n A[First] --&gt; B</div>
            <div class="mermaid-preview">not a diagram</div>
            <div class="mermaid-preview">sequenceDiagram\n Alice-&gt;&gt;Bob: Hello</div>`);
        await markdown.addScriptTag({ content: markdownScript });
        await markdown.waitForFunction(() => document.querySelectorAll('svg.pele').length === 2 && document.querySelector('.mermaid-error'));
        for (const dark of [true, false]) {
            await markdown.evaluate(dark => document.body.classList.toggle('vscode-dark', dark), dark);
            await markdown.waitForFunction(dark => {
                const diagrams = document.querySelectorAll('.mermaid-preview > svg.pele');
                return diagrams.length === 2 && [...diagrams].every(svg => svg.style.getPropertyValue('--pele-bg') === (dark ? '#1e1e1e' : '#ffffff'));
            }, {}, dark);
        }
        await markdown.evaluate(() => {
            document.querySelector('.mermaid-preview').textContent = 'flowchart LR\n A[Updated] --> B';
            window.dispatchEvent(new Event('vscode.markdown.updateContent'));
        });
        await markdown.waitForFunction(() => document.querySelector('.mermaid-preview svg')?.textContent.includes('Updated'));
        await markdown.evaluate(source => {
            document.querySelector('.mermaid-preview').textContent = source;
            window.dispatchEvent(new Event('vscode.markdown.updateContent'));
        }, cloudDiagram);
        await markdown.waitForFunction(() => document.querySelectorAll('.mermaid-preview .pele-icon svg').length === 3);
        await markdown.evaluate(source => {
            document.querySelector('.mermaid-preview').textContent = source;
            window.dispatchEvent(new Event('vscode.markdown.updateContent'));
        }, s3Diagram);
        await markdown.waitForSelector('.mermaid-preview [data-icon="aws:res-amazon-simple-storage-service-s3-standard"] svg path');
        await markdown.close();
        console.log('Panel and Markdown rendering, updates, zoom, limits, themes, and error recovery passed.');
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
