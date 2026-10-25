# Pele Preview

Preview Mermaid diagrams in Visual Studio Code with [Pele](https://github.com/obsidianmd/pele).

## Use

1. Open a `.mmd` or `.mermaid` file.
2. Select **Preview Diagram** in the editor toolbar. You can also use the editor context menu or run **Pele Preview: Preview Diagram** from the Command Palette.
3. Edit the source. The preview updates as you type.

## Rendering

Font Awesome Free, logos, MDI, AWS, Azure, and GCP icon data is included in the extension. Cloud icons include SVGs downloaded directly from the providers. Icons work in the diagram preview, Markdown preview, and exports without a network connection. See [icon syntax and sources](docs/icon-packs.md).

## Settings

| Setting                   | Default | Use                                                            |
| ------------------------- | ------- | -------------------------------------------------------------- |
| `pelePreview.maxZoom`     | `5`     | Maximum zoom as a multiple of 100%. A value of `5` means 500%. |
| `pelePreview.maxTextSize` | `90000` | Maximum number of characters in diagram source.                |
| `pelePreview.maxEdges`    | `1000`  | Maximum number of diagram edges.                               |

## Development

Use Node.js 22 and pnpm 9.7.1.

```sh
pnpm install --frozen-lockfile
pnpm compile
pnpm lint
pnpm test:renderers
pnpm test
pnpm package
```

Press `F5` in VS Code to build and start the extension in a development window.

## Project information

- [Source and issues](https://github.com/pskchai/vscode-pele-preview)
- [Changelog](CHANGELOG.md)
- [MIT license](LICENSE)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

Pele Preview is derived from [Mermaid Chart’s VS Code Mermaid Preview](https://github.com/Mermaid-Chart/vscode-mermaid-preview) and is maintained as an independent project. The original license notices are kept.
