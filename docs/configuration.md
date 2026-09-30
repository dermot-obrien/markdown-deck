<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Configuration reference

A deck takes its settings from three places. The first that sets a value wins:

1. A command-line option, such as `--theme`, for one build.
2. The document's front matter, such as `deck_theme`, for one deck.
3. The repository binding, such as `theme` in `[suite.markdown-deck]`, for every deck in the repository.

Anything none of them sets takes the built-in default. Library callers pass the same settings as `build()` options, and `bindings: false` ignores the repository.

## The binding file

The repository binding is the `[suite.markdown-deck]` section of `.agents/skill-bindings.toml`, the file that binds a suite of skills to a repository. `skill-bindings.toml` at a folder's top level is also found. The nearest one at or above the document is used, so a deck built from anywhere in the repository gets the same defaults. Other sections of the file are ignored.

```toml
[suite.markdown-deck]
theme      = "default"
palette    = "dusk"
background = { image = "art/texture.png", slides = "content", wash = 0.85 }
comments   = true
feedbackTo = "reviews@example.com"
pdf        = true

[suite.markdown-deck.palettes.dusk]
heading  = "#3b2f5c"
accent   = "#8f7bb8"
cover-bg = "#1f1a2e"

[suite.markdown-deck.palettes.meadow]
heading  = "#2e5e3a"
accent   = "#7fae6b"
cover-bg = "#1c3324"
```

The reader is deliberately small. It takes quoted strings, `true`, `false`, numbers, inline tables (`{ key = value, ... }`) and sub-tables two levels deep, such as `[suite.markdown-deck.palettes.dusk]`. An array is refused with `unsupported value`. Keep each string on one line.

Paths in the binding resolve against the folder that holds the binding file, `.agents/` for the usual location, so they do not depend on where a build is run from.

The keys are declared in the skill's `inputs.toml`. `node <skill>/bin/check.mjs`, run from the workspace root, validates them; so does `model doctor --skill markdown-deck` where the optional model skill is installed.

## Keys

| Binding | Front matter | Option | Type | Default |
|---|---|---|---|---|
| `theme` | `deck_theme` | `--theme` | built-in name or `.css` path | `default` |
| `palette` | `deck_palette` | `--palette` | table of tokens, scheme name, or `none` | none |
| `palettes` | | | table of named token tables | none |
| `background` | `deck_background` | `--background` | path, `none`, or table | none |
| `comments` | `deck_comments` | `--comments` | boolean | `false` |
| `thumbnails` | `deck_thumbnails` | `--thumbnails` | boolean | `false` |
| `slideNumbers` | `deck_slide_numbers` | `--no-slide-numbers` | boolean | `true` |
| `pdf` | `deck_pdf` | `--pdf`, `--no-pdf` | boolean | `false` |
| `tableRows` | `deck_table_rows` | `--table-rows` | integer, 0 for never | `12` |
| `documentBase` | `deck_document_base` | `--document-base` | URL, absolute or from the site root | none |
| `feedbackTo` | `deck_feedback_to` | `--feedback-to` | email address or comma-separated list | none |
| `feedbackSubject` | `deck_feedback_subject` | `--feedback-subject` | text | `Review: <deck title>` |
| `mermaid` | | `--mermaid` | path to `mermaid.min.js`, or URL | installed copy, else CDN |
| `registry` | | `--registry`, `--no-registry` | path to a JSON file | none |

### theme

A built-in theme name (`node bin/markdown-deck.mjs themes` lists them) or a path to a `.css` file of tokens. In the binding, a `.css` path resolves against the binding file; on the command line, against the working directory.

```toml
theme = "themes/house.css"
```

### palette

Colour tokens laid over whichever theme is chosen. Either a table of tokens, or the name of a scheme in `palettes`, or `none` for the theme's own colours.

```toml
[suite.markdown-deck.palette]
heading = "#143a5a"
accent  = "#2f8f83"
```

```yaml
deck_palette: meadow         # a scheme from palettes
deck_palette: none           # the theme's own colours
deck_palette:                # a table of tokens
  heading: "#2e5e3a"
```

Tokens are the theme's custom properties without the `--`: `font-body`, `font-mono`, `deck-bg`, `slide-bg`, `slide-fg`, `body`, `heading`, `on-heading`, `rule`, `row-alt`, `accent`, `accent-deep`, `accent-wash`, `code-bg`, `code-fg`, `code-inline-bg`, `cover-bg`, `cover-fg`, `cover-accent`, `cover-muted`, `cover-faint`, `divider-bg`, `divider-fg`, `divider-accent`, `divider-muted`, `chrome-fg`. An unknown token fails the build. An unknown scheme name fails the build and lists the known ones.

A palette replaces a palette: a deck's `deck_palette` is used instead of the repository's, not merged with it.

### palettes

Named colour schemes, each a table of the same tokens `palette` takes. Binding only, since the point is to name them once for every deck.

```toml
[suite.markdown-deck.palettes.dusk]
heading = "#3b2f5c"

[suite.markdown-deck.palettes.meadow]
heading = "#2e5e3a"
```

An unknown token in any scheme fails every build in the repository, not just the decks that pick it, so a typo is found at once.

### background

An image behind the slides. A path, `none`, or a table:

| Key | Values | Default |
|---|---|---|
| `image` | path to a `.png`, `.jpg`, `.jpeg`, `.svg` or `.webp` file; required | |
| `slides` | `all`, `cover`, or `content` (every slide but the cover) | `all` |
| `fit` | `cover` (fill, cropping), `contain` (whole image, letterboxed) or `repeat` (tiled at its own size) | `cover` |
| `position` | a CSS `background-position`, such as `center`, `top right` or `20% 80%` | `center` |
| `wash` | 0 to 1: how much of the slide's own ground colour lies over the image | `0` |

```toml
background = "art/texture.png"
```

```toml
[suite.markdown-deck.background]
image    = "art/texture.png"
slides   = "content"
fit      = "cover"
position = "center"
wash     = 0.85
```

```yaml
deck_background: art/cover-photo.jpg

deck_background:
  image: art/cover-photo.jpg
  slides: cover
  wash: 0.3

deck_background: none
```

The path resolves against the file that gives it: the binding file for `background`, the document for `deck_background`, the working directory for `--background`. The image is copied into the deck's `assets/` folder and referenced relatively, so the deck opens from disk and the PDF includes it. A background replaces a background as a whole; a deck that gives only a path gets the defaults for the other keys, not the repository's.

The wash is the slide's ground colour: white over a content slide in the default theme, `cover-bg` over the cover and dividers. It keeps text readable over a busy image; 0.8 or more suits body text, lower suits a cover. Designed HTML slides are not changed: the image sits behind their frame, and `header="true"` keeps the deck's header.

A missing image, an unsupported type or an unknown key fails the build.

### comments

`true` adds the per-slide review panel. See [Review comments](concepts.md#review-comments).

### thumbnails

`true` opens the slide index with thumbnails rather than titles. `T` switches either way in the deck.

### slideNumbers

Every slide but the first carries its page number, bottom right, on screen and in the PDF. The number counts the cover, so it matches the PDF's page number. `false` leaves it off. A theme colours it with `--slide-number-fg`; on dividers it takes `--divider-muted`.

### pdf

`true` makes `build` export `deck.pdf` without `--pdf`. `--no-pdf` turns it off for one build. `publish` exports PDFs only with its own `--pdf`, whatever this says. Needs Playwright and a browser; see [Commands](commands.md#pdf).

### tableRows

Rows a table may carry on one slide before it continues on the next, header repeated. `0` never splits, so a long table shrinks to fit. `table-rows="20"` on one `deck:slide` tag overrides it for that slide.

### documentBase

Where the workspace's Markdown documents are published, such as `/docs/` or `https://docs.example.com/`. A slide's link to another `.md` or `.mdx` document of the workspace then goes to that document's page: its path from the workspace root without the extension, a folder's `index.md` or `README.md` standing for the folder, as a folder URL ending in `/`. A `slug` in the linked document's front matter replaces that route when it starts with `/`, and replaces the file name within its folder otherwise. The fragment is kept, so `[x](./guide.md#setup)` becomes `/docs/topic/guide/#setup`.

Unset, the link goes to the source file by a path from the deck, which works while the deck is opened from disk beside the workspace but not once it is published on its own. A link to a document that does not exist is left as written and warned about. Inline links, reference definitions and `<a href>` are covered, in the deck's own slides, included sections and designed HTML slides; links to other files, to URLs and within the page are not touched.

### feedbackTo and feedbackSubject

Where the review email goes, and its subject. Several addresses are comma-separated. An address with an apostrophe needs a double-quoted TOML string and double quotes in YAML.

### mermaid

Where decks load mermaid from, for slides with a mermaid diagram. A path to `mermaid.min.js` is copied beside each deck that needs it; a URL is loaded from there. Unset, the nearest installed `node_modules/mermaid` is copied, else the jsDelivr CDN is used.

### registry

The published-deck registry, a JSON file committed with the workspace. `publish` records every deck URL there and fails when one that was published disappears. See [Publishing](concepts.md#publishing-a-workspace).

## Other front matter

These have no binding, because they describe one document.

| Key | Meaning | Default |
|---|---|---|
| `title` | The deck title, on the cover and in the index | `sidebar_label`, else the file name |
| `description` | The cover subtitle when the `deck:cover` tag gives none | none |
| `sidebar_label` | Fallback for `title` and `deck_eyebrow` | none |
| `deck_eyebrow` | The small line above every slide title; `""` turns it off | `sidebar_label` |
| `deck_id` | Stable id: keys stored review comments, and is the deck's URL when published. Lower-case-hyphenated | a slug of the title |
| `version`, `status` | Recorded in `manifest.json` | `0.1`, `Draft` |
| `deck_publish` | `true` to publish the document with `markdown-deck publish` | `false` |
| `deck_menu` | Menu group for a site, such as `Planning / FY30` | top level |
| `deck_menu_label` | Menu entry | the title |
| `deck_menu_order` | Order within the group, lower first | none |

Options with no front matter or binding: `--title`, `--subtitle`, `--date`, `--footnote`, `--eyebrow`, `--logo`, `--deck-id`, `--html-name`, `--partials` and `--refresh`. See [Commands](commands.md).

## Theme tokens for backgrounds

A theme file can carry a background itself, with the tokens the `background` setting writes:

```css
:root {
  --slide-bg-image: url("texture.png");
  --slide-bg-size: cover;          /* cover, contain, auto */
  --slide-bg-repeat: no-repeat;    /* no-repeat, repeat */
  --slide-bg-position: center;
  --slide-bg-wash: 0.85;           /* 0 to 1 */
}
```

A theme's own `url(...)` is not copied into `assets/`; it resolves against the deck, so prefer the `background` setting, which copies the file. A `background` setting overrides a theme's tokens, and `none` switches a theme's image off.
