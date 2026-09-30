<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Command reference

The CLI is `bin/markdown-deck.mjs` in the skill directory. Run it with Node from anywhere; every path it touches comes from its arguments:

```bash
node <skill>/bin/markdown-deck.mjs <command> [arguments]
```

`<skill>` is wherever the skill is installed, such as `.agents/skills/markdown-deck`. Installed globally with npm, the same CLI is `markdown-deck`.

`--help` prints the usage and exits 0. Run with no command, it prints the usage and exits 1. An error is printed as `  ! <message>` and exits 1.

## build

```bash
node <skill>/bin/markdown-deck.mjs build <input.md> [options]
```

Builds one tagged document into a deck. It prints the slide count and the deck's path, then any warnings as `  ! ...` lines and a count.

| Option | Meaning | Front matter, binding |
|---|---|---|
| `--out <dir>` | Output folder | default `<input dir>/dist` |
| `--theme <name>` | Built-in theme, or a path to a `.css` file | `deck_theme`, `theme` |
| `--palette <name>` | A scheme from the `palettes` binding, or `none` for the theme's own colours | `deck_palette`, `palette` |
| `--background <path>` | Image behind every slide, or `none` to turn a configured one off. Relative to the working directory | `deck_background`, `background` |
| `--title <text>` | Deck title | `title` |
| `--subtitle <text>` | Cover subtitle | `subtitle="..."` on `deck:cover`, `description` |
| `--date <text>` | Cover date | `date="..."` on `deck:cover` |
| `--footnote <text>` | Cover footnote | `footnote="..."` on `deck:cover` |
| `--eyebrow <text>` | Small line above every slide title | `deck_eyebrow`, `sidebar_label` |
| `--logo <path>` | Cover logo, relative to the output folder | `logo="..."` on `deck:cover` |
| `--mermaid <src>` | `mermaid.min.js` to copy beside the deck, or a URL | `mermaid` |
| `--partials` | Also write `slides/*.html` fragments for hosts that embed slides | |
| `--table-rows <n>` | Rows per slide before a table continues; `0` never splits | `deck_table_rows`, `tableRows` |
| `--thumbnails` | Open the slide index with thumbnails | `deck_thumbnails`, `thumbnails` |
| `--no-slide-numbers` | Leave the page number off every slide | `deck_slide_numbers`, `slideNumbers` |
| `--comments` | Add the review comments panel | `deck_comments`, `comments` |
| `--feedback-to <a>` | Where the review email goes | `deck_feedback_to`, `feedbackTo` |
| `--feedback-subject <s>` | Subject of the review email | `deck_feedback_subject`, `feedbackSubject` |
| `--deck-id <id>` | Stable id for stored comments and the published URL | `deck_id` |
| `--html-name <f>` | File name for the deck, such as `index.html` | default `deck.html` |
| `--refresh` | Re-render a stale diagram image through the model skill before using it | |
| `--pdf`, `--no-pdf` | Export `deck.pdf`, or not | `deck_pdf`, `pdf` |

Output, in the output folder:

| File | What it is |
|---|---|
| `deck.html` | The deck. Self-contained: open it from disk, no server |
| `assets/` | Every local image, video, HTML slide resource, background image and mermaid copy the deck uses |
| `manifest.json` | The deck's id, title, slides, and `dependencies`: the documents and images it was built from |
| `deck.pdf` | With `--pdf`, one 16:9 page per slide |
| `slides/*.html` | With `--partials` |

In the deck: the arrow keys or Previous and Next move between slides, `I` toggles the index, `T` switches it between titles and thumbnails, `F` presents full screen, and `C` toggles the comments panel where there is one.

## pdf

```bash
node <skill>/bin/markdown-deck.mjs pdf <deck.html> [--out <file.pdf>]
```

Prints an already built deck to PDF, by default `deck.pdf` beside it. `build --pdf` does the same in one step.

PDF export needs Playwright, which `npm install` in the skill installs as an optional dependency, and a browser. It tries Microsoft Edge, then Google Chrome, then Playwright's bundled Chromium, and prints the one it used as `browser: msedge`. Windows always has Edge. Elsewhere, install Chrome or run `npx playwright install chromium`. Two environment variables choose explicitly:

| Variable | Meaning |
|---|---|
| `MARKDOWN_DECK_CHANNEL` | A Playwright channel, such as `msedge`, `chrome` or `chromium` |
| `MARKDOWN_DECK_BROWSER` | A path to a browser executable |

A slide shrunk below 60 percent to fit is reported as `slide N "Title" shrunk to NN% to fit`.

## publish

```bash
node <skill>/bin/markdown-deck.mjs publish [<root>] --out <dir> [options]
```

Builds every document under `<root>` (default the working directory) whose front matter says `deck_publish: true`, each to `<dir>/<deck_id>/index.html`.

| Option | Meaning |
|---|---|
| `--out <dir>` | Required. Where decks are written |
| `--list` | Show what would be published, without building |
| `--pdf` | Also export `<dir>/<deck_id>/<deck_id>.pdf` for each deck. The `pdf` binding does not apply here |
| `--skip a,b/c` | Folders to leave out, by name or root-relative path. Hidden folders, `node_modules`, `build`, `dist`, `.docusaurus` and `<dir>` are always left out |
| `--reserved id,id` | Ids something else already serves, which no deck may take |
| `--registry <file>` | The published-deck registry, instead of the `registry` binding |
| `--no-registry` | Ignore a bound registry |
| `--registry-check` | Only check the registry: a deck it does not know fails rather than being recorded. On by default when `CI` is set |
| `--graph` | Print what each deck was built from, and anything used by more than one deck |

A problem with one deck, such as a missing `deck_id` or an include whose target moved, is reported and fails the command, but the other decks are still built. See [Publishing a workspace](concepts.md#publishing-a-workspace).

## themes

```bash
node <skill>/bin/markdown-deck.mjs themes
```

Lists the built-in themes, one per line.

## The post-install check

```bash
node <skill>/bin/check.mjs
```

Run from the workspace root. It checks Node 18 or newer, that `npm install` has been run in the skill, and, where the workspace binds `[suite.markdown-deck]`, that the binding parses, the theme exists, every palette and named scheme uses only known tokens, a palette named by scheme exists, the background image exists and is a supported type, and the mermaid and registry paths resolve. It prints `markdown-deck: ok`, or one line per problem. Missing Playwright is a warning, since only PDF export needs it.

| Exit | Meaning |
|---|---|
| 0 | All is well; warnings may be printed |
| 1 | Problems, one per line |
| 2 | A usage or environment error, such as Node older than 18 |

`SKILL_DIR` names the skill directory when the script is run from a copy elsewhere; otherwise the script's own skill is checked. It checks the binding, not each deck's front matter; a build reports those.

## From code

The skill is also a library:

```js
import { build } from './src/index.mjs';
import { exportPdf } from './src/pdf.mjs';
import { publishAll } from './src/publish.mjs';

const r = build('talk.md', { out: 'dist', palette: 'dusk', background: 'art/texture.png' });
if (r.pdf) await exportPdf(`${r.outDir}/${r.manifest.html}`, `${r.outDir}/deck.pdf`);
```

`build()` takes the options above in camel case (`tableRows`, `feedbackTo`, `deckId`, `htmlName`, `mermaidSrc`), plus `background` as a table, `palette` as a table of tokens, `bindings: false` to ignore the repository, `strictRenders` to fail on a stale diagram image, and `onWarn` and `onLog` callbacks. `src/catalog.cjs` exports `findPublishedDecks` and `menuItems` for a site's menu.
