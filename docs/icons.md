# Status bar brand icons

`assets/icons/ai-status-bar-icons.woff` is a two-glyph icon font contributed via
`contributes.icons` in `package.json`, so it can be used as `$(ai-status-bar-claude)` and
`$(ai-status-bar-codex)` anywhere a `ThemeIcon` works, including `StatusBarItem.text`.

## Sources

Both glyphs are unmodified monochrome marks from the third-party
[`glincker/thesvg`](https://github.com/glincker/thesvg) icon pack, not from Anthropic's or
OpenAI's own official brand channels:

- `assets/icons/claude.svg` —
  <https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/claude/mono.svg>
- `assets/icons/codex.svg` —
  <https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/codex-openai/mono.svg>

Used nominatively, to identify the products whose usage this extension reports.

## Regenerating the WOFF

The font is built once, offline, from `assets/icons/claude.svg` and
`assets/icons/codex.svg`. No font-building library is a project dependency — run the
build from a scratch directory:

```sh
mkdir /tmp/icon-build && cd /tmp/icon-build
npm init -y
npm install --no-audit --no-fund svgicons2svgfont@16.0.0 svg2ttf@6.1.0 ttf2woff@3.0.0
```

Then run a script equivalent to the following (adjust `REPO_ROOT`), which assembles an
intermediate SVG font, converts it to TTF, then to WOFF, and removes the intermediates:

```js
const fs = require('fs');
const path = require('path');
const { SVGIcons2SVGFontStream } = require('svgicons2svgfont');
const svg2ttf = require('svg2ttf');
const ttf2woff = require('ttf2woff');

const REPO_ROOT = '/path/to/ai-status-bar';
const ICONS_DIR = path.join(REPO_ROOT, 'assets', 'icons');
const glyphs = [
  { file: 'claude.svg', unicode: 0xe001, name: 'claude' },
  { file: 'codex.svg', unicode: 0xe002, name: 'codex' },
];

// See git history of this file for the full, runnable version of this script.
```

`fantasticon` (the more common CLI for this) was tried first and rejected: v4.1.0 builds
its glob pattern with `path.join`, which emits backslashes on Windows, and the `glob` v11
it bundles does not match backslash-separated patterns against Windows drive-letter
paths — it fails with `No SVGs found` even when the SVGs are present. The libraries above
are what `fantasticon` itself wraps, called directly to sidestep that bug.

## Codepoints

| Icon ID | Codepoint | Source file |
| --- | --- | --- |
| `ai-status-bar-claude` | `U+E001` | `assets/icons/claude.svg` |
| `ai-status-bar-codex` | `U+E002` | `assets/icons/codex.svg` |

Both are in the Private Use Area, so they cannot collide with a real Unicode character.

## Constraints

- Contributed icons must be single-color; VS Code renders them in the status bar
  foreground color, so they follow the active theme automatically.
- Keep `fontHeight: 512` and `normalize: true` (or equivalent) if regenerating, so both
  glyphs sit at a consistent visual weight relative to each other.

## Panel brand icons

The sidebar panel shows the same Claude and Codex marks next to each agent's name, read
directly from `assets/icons/claude.svg` / `codex.svg` — the same files the WOFF font is
built from (see "Sources" above), so there's exactly one place to update either mark.

Unlike the WOFF glyphs, these ship as raw SVG files in the `.vsix` because [`usageViewProvider.ts`](../src/panel/usageViewProvider.ts) reads
them via `vscode.workspace.fs.readFile` at first render and inlines the markup as text into
the webview's HTML — not loaded through `<img src>`, which would isolate the SVG from the
page's CSS. Inlining lets a plain stylesheet rule (`fill: currentColor` in
[`panelHtml.ts`](../src/shared/panelHtml.ts)) theme them to the current foreground color,
overriding whatever `fill` (or lack of one) the source file itself declares — the same
effect the status-bar font glyphs get for free from being a font. `panelHtml.ts` itself
never hardcodes icon markup; it only renders whatever `icons` map it's given, which is what
keeps it `vscode`-free and unit-testable.

Adding a new provider's brand mark: drop `assets/icons/<name>.svg`, and add its icon id to
`ICON_IDS` in `usageViewProvider.ts` (the id must equal `provider.icon`, and the file name
is that id with the `ai-status-bar-` prefix stripped).

## Activity-bar icon

`assets/activity-bar.svg` is **hand-authored for this project**, not sourced from a
third-party pack like the two glyphs above. It's a simplified, monochrome echo of the
marketplace icon's rows-of-bars motif (`assets/icon.png`): three solid rounded bars of
varying width, no dots or segmented rectangles and no enclosing card — those details don't
read at 24px and looked "dashed" rather than like bars. VS Code renders
`viewsContainers.activitybar` icons as an alpha mask, so only the shape's silhouette
matters — fill color in the file is ignored in favor of the current theme's activity-bar
foreground.
