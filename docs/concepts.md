<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Concepts

markdown-deck keeps one Markdown document as the only source of a deck. You tag the sections an audience needs; the build turns those into slides and leaves the rest of the document alone.

- [The document is the source](#the-document-is-the-source)
- [Tags](#tags)
- [Themes](#themes)
- [Palettes and named colour schemes](#palettes-and-named-colour-schemes)
- [Background images](#background-images)
- [Images, media and designed slides](#images-media-and-designed-slides)
- [Section dividers](#section-dividers)
- [Long tables](#long-tables)
- [Including slides from other documents](#including-slides-from-other-documents)
- [Diagrams: mermaid and rendered images](#diagrams-mermaid-and-rendered-images)
- [Review comments](#review-comments)
- [Publishing a workspace](#publishing-a-workspace)

## The document is the source

Tags are HTML comments, so a tagged document still reads as a normal document wherever Markdown renders, and untagged sections stay document-only. Slide boundaries never use a `---` ruler, because a ruler is visible in the rendered document.

Write the document first and tag it second. A document written to be a deck reads badly as a document, and the document is the artefact that outlives the meeting.

Every slide is a fixed 1920x1080 canvas, so the HTML and the PDF are always 16:9. Content taller than the slide is shrunk to fit, widening first so it still spans the slide. The deck is one HTML file plus an `assets/` folder, and it opens from disk with no server.

## Tags

| Tag | Placement | Effect |
|---|---|---|
| `<!-- deck:cover subtitle="..." date="..." footnote="..." logo="..." -->` | Anywhere, usually after the H1 | The cover slide, titled by the document's title |
| `<!-- deck:slide label="..." -->` | Immediately before a heading | That heading's section becomes one slide, running to the next heading of the same or higher level |
| `<!-- deck:divider subtitle="..." -->` | Before a heading, or anywhere with `title="..."` | A section divider |
| `<!-- deck:image src="./slide.png" title="..." -->` | On its own line | A whole slide from a finished 16:9 image |
| `<!-- deck:html src="./slide.html" title="..." -->` | On its own line | A whole slide from a self-contained HTML file |
| `<!-- deck:include src="../other.md" section="Heading" -->` | On its own line | A section of another document, as a slide |
| `<!-- deck:skip -->` ... `<!-- /deck:skip -->` | Inside or around sections | Kept in the document, dropped from the deck |
| `<!-- deck:note -->` ... `<!-- /deck:note -->` | Inside a tagged section | Presenter notes, never on screen or in the PDF |

Every attribute of every tag is in the [tag reference](tags.md). A `deck:slide` tag attaches to the next heading, not the one before it. Put each tag on its own line with a blank line either side. The slide's title is the heading text, unless `title="..."` overrides it, and its id, used in the slide's address such as `deck.html#interfaces`, comes from `label` or the title. `eyebrow="..."` on a `deck:slide` sets the small line above its title for that slide.

A slide needing more than about twelve lines of body is too dense. Split the section, or move the overflow inside `deck:skip`. Around a whole section or appendix, `deck:skip` drops every tag inside it too.

A tag inside a fenced code block is text, not a tag, so a document can show tags in an example.

Reference links, `[text][label]` with `[label]: url` at the foot of the document, resolve on every slide. A link to another Markdown document goes to its published page when [documentBase](configuration.md#documentbase) is set, and otherwise to the source file by a path from the deck. [What happens to links and files in a slide](tags.md#what-happens-to-links-and-files-in-a-slide) covers the rest.

## Themes

A theme is a CSS file of tokens, custom properties such as `--heading` and `--slide-bg`. `themes/_base.css` holds the layout and never names a colour, so a theme is about thirty lines. `default` is brand-free.

```bash
node <skill>/bin/markdown-deck.mjs themes
node <skill>/bin/markdown-deck.mjs build talk.md --theme ./themes/mine.css
```

To make one, copy `themes/default.css` and change the values. Dividers use the cover tokens unless the theme sets `--divider-bg`, `--divider-fg`, `--divider-accent` and `--divider-muted`; the slide index and toolbar use the cover tokens unless it sets `--index-*` and `--toolbar-*`.

For an organisation's own colours, prefer a palette over a theme file: the layout stays with the skill, and the colours stay in the repository.

## Palettes and named colour schemes

A palette is a table of tokens laid over whichever theme is chosen. Keys are token names without the `--`:

```toml
[suite.markdown-deck.palette]
heading  = "#143a5a"
accent   = "#2f8f83"
cover-bg = "#0b2438"
```

When a repository wants more than one look, it names schemes once in `palettes` and picks one by name:

```toml
[suite.markdown-deck]
palette = "dusk"            # the default for every deck

[suite.markdown-deck.palettes.dusk]
heading  = "#3b2f5c"
cover-bg = "#1f1a2e"

[suite.markdown-deck.palettes.meadow]
heading  = "#2e5e3a"
cover-bg = "#1c3324"
```

A deck picks another in its front matter, and a build on the command line:

```yaml
deck_palette: meadow
```

```bash
node <skill>/bin/markdown-deck.mjs build talk.md --palette meadow
```

`deck_palette: none`, or `--palette none`, uses the theme's own colours. `deck_palette` can still be a table of tokens, as before schemes existed. An unknown token, or a scheme name that is not in `palettes`, fails the build and names what is known. The token list is in the [configuration reference](configuration.md#palette).

## Background images

A background puts an image behind the slides: a texture, a photograph on the cover, a faint mark in a corner. Set it once for the repository and override it per deck:

```toml
[suite.markdown-deck]
background = { image = "art/texture.png", slides = "content", wash = 0.85 }
```

```yaml
deck_background:
  image: art/launch-photo.jpg
  slides: cover
  wash: 0.2
```

`slides` chooses where it appears: `all`, `cover`, or `content`, meaning every slide but the cover, dividers included. `fit` is `cover` (fill the slide, cropping), `contain` (show all of it) or `repeat` (tile it). `position` is a CSS `background-position`. `wash` lays the slide's own ground colour over the image, from 0 (none) to 1 (hides it), so text stays readable; 0.8 or more suits body text. A plain path means `slides = "all"`, `fit = "cover"`, no wash. `none` turns a repository background off for one deck, and `--background` sets one for one build.

The image, a png, jpg, svg or webp, is copied into the deck's `assets/` folder, so the deck still opens from disk and the PDF includes it. A background that is declared but missing fails the build: a deck that silently lost its background looks finished and is not.

It works through the theme's tokens, `--slide-bg-image`, `--slide-bg-size`, `--slide-bg-repeat`, `--slide-bg-position` and `--slide-bg-wash`, so themes and palettes compose with it: a palette changes the ground colour, and the wash follows. A designed HTML slide keeps its own content; the image sits behind its frame and shows only where the HTML is transparent.

## Images, media and designed slides

Local images in a slide are copied into `assets/` and their paths rewritten. A missing image is warned about and left alone. Video, audio and other files a slide loads, `src` and `poster` on any HTML tag, are copied the same way; media over 50 MB is warned about.

`deck:image` makes a whole slide from a finished image, such as a slide exported from another deck. Use a PNG at 1920x1080 or larger in 16:9; the build warns about one that is not 16:9, which is letterboxed, or smaller, which looks soft. `header="true"` puts the deck's header above the image.

`deck:html` makes a whole slide from a self-contained HTML file drawn on the 1920x1080 canvas, for a design Markdown cannot express. It is isolated in a frame, so its styles and scripts cannot reach the deck, and the deck still provides the index, navigation, comments and PDF. The files it loads, including stylesheet links and CSS `url(...)`, are copied into `assets/`. Anything it loads from the network is warned about, since the deck is meant to open from disk. `header="true"` puts the deck's header above it. Prefer Markdown: an HTML slide's text is not in the document.

## Section dividers

`<!-- deck:divider -->` before a heading makes a divider titled by that heading, on the cover's ground, to mark where one part of a deck ends and the next begins. The heading's body stays in the document. With `title="..."` the tag stands alone anywhere. `subtitle` adds a line under the title, `eyebrow` a small line above it such as "Part 2", and `label` its index entry. Use dividers for the parts of a long deck, not before every slide.

## Long tables

A table longer than twelve rows continues on the next slide with its header repeated, rows spread evenly, so 26 rows become 9, 9 and 8. The slides are titled "Interfaces (1 of 3)" and so on; the first keeps the section's id. Text before the table stays with its first rows, text after it follows the last, and presenter notes stay on the first slide.

Change the limit with `table-rows="20"` on one `deck:slide` tag, `deck_table_rows` for a deck, `tableRows` for a repository, or `--table-rows` for a build. `0` never splits, leaving a long table to shrink to fit. A table in a code fence is never split.

## Including slides from other documents

`<!-- deck:include src="../methodology/playbook.md" section="Stage 1: budget" -->` places a section of another document in this deck, rendered at build time in this deck's theme, so it is always current. The source need not be a deck. Its heading becomes the slide title, and the eyebrow reads "From <source title>", naming the source by its `deck_eyebrow`, `sidebar_label` or `title`.

| Attribute | Meaning |
|---|---|
| `src` | The source document, relative to this one |
| `deck` | Instead of `src`: a published deck by its `deck_id`, found in the workspace, so the include survives the source being moved |
| `section` | The heading to take, ignoring case |
| `slide` | Instead of `section`: a slide the source already tags, by its id |
| `title`, `label` | Rename the slide and its index entry |
| `eyebrow` | Replace the "From <source>" line; `eyebrow=""` removes it |
| `header` | `true` keeps the header layout for a section that is only an image |

A section that is only an image is shown full-bleed, like `deck:image`. A missing file, deck, section or slide fails the build, and the message lists what exists.

## Diagrams: mermaid and rendered images

Mermaid fences render as diagrams. The build copies an installed `mermaid.min.js` into `assets/`, so diagrams draw offline; with none installed it loads mermaid from the jsDelivr CDN. The `mermaid` binding, or `--mermaid`, names a file or URL instead.

An image rendered from a diagram goes stale when the diagram changes. A renderer that follows the convention, such as the model skill's `render`, leaves `<image>.render.json` beside the image. When the diagram no longer matches, the build warns and prints the command that re-renders it; with `CI` set it fails. `build --refresh` re-renders stale images through the model skill before building.

Every `manifest.json` lists `dependencies`: the source, every included document, and every image, background included, relative to the workspace root. `publish --graph` prints them for every deck, then anything used by more than one.

## Review comments

`--comments`, `deck_comments: true` or `comments = true` adds a panel for comments per slide; `C` toggles it. Reviewers add, edit and delete comments against the slide they are on, and the index shows how many each slide has. Comments stay in the reviewer's browser, keyed by the deck's `deck_id`, until they send them, so give a reviewed deck a stable `deck_id`.

Once there is a comment, Send review opens one dialog: the reviewer's name, a summary, and a send button.

| Sender | What it does |
|---|---|
| Email, the default | Opens the mail client addressed to `feedbackTo`, the review grouped by slide in deck order, each slide linked. A review too long for a mail link is copied or downloaded, and the email says where |
| Copy | Puts the review, with a JSON copy, on the clipboard |
| Download | Saves `review-<deck-id>-<date>.md` |

After sending, the dialog asks whether to clear the sent comments, since the page cannot know an email went.

## Publishing a workspace

A document publishes itself. Its front matter decides whether it becomes a deck and where it sits in a site menu:

```yaml
deck_publish: true
deck_id: fy30-plan              # permanent URL /decks/fy30-plan/; required, lower-case-hyphenated
deck_menu: "Planning / FY30"    # menu group; omit for the top level
deck_menu_label: "FY30 Plan"    # defaults to the title
deck_menu_order: 10             # lower first within its group
```

```bash
node <skill>/bin/markdown-deck.mjs publish . --out site/static/decks --list
node <skill>/bin/markdown-deck.mjs publish . --out site/static/decks
```

Run `--list` first. A deck that asks to be published but cannot be, with a missing, malformed, duplicate or reserved id, or no `deck:` tags, fails the command rather than disappearing.

### The published-deck registry

A deck URL is stable only while its `deck_id` does not change. The registry makes that a check. Bind it, or pass `--registry <file>`:

```toml
[suite.markdown-deck]
registry = "../site/decks/published-decks.json"
```

| Situation | Result |
|---|---|
| A new deck | Recorded, with its slide ids. Commit the file |
| A published deck that is gone | The publish fails, naming the deck |
| An entry marked `"status": "retired"` | Allowed to be gone |
| An entry marked `"status": "redirected"` with `"redirect": "<deck_id>"` | A redirect page is written at the old URL, keeping the slide address |
| A slide id that disappears | A warning: links to that slide now open the deck at its start |

With `--registry-check`, or when `CI` is set, the registry is only checked, so an uncommitted registry fails before deploy.

### In a Docusaurus site

Run `publish` before `docusaurus build`, into a folder Docusaurus serves as static files, and build the menu from the same front matter:

```js
// docusaurus.config.js
const {findPublishedDecks, menuItems} = require('<skill>/src/catalog.cjs');
const decks = findPublishedDecks(__dirname, {skip: ['static']}).decks;
// navbar: { items: [{ type: 'dropdown', label: 'Decks', position: 'left', items: menuItems(decks) }] }
```

`menuItems` returns dropdown items. A dropdown cannot nest, so a menu path becomes one group heading, `Planning › FY30` for a deeper one, with its decks beneath; top-level decks come first. Style the headings with the `deck-menu-group` class and the decks with `deck-menu-item`. Entries from another source can be merged in, as objects with `id`, `label`, `menu` and `order`, and an `href` to override the URL. `menuItems(decks, { base: 'slides' })` serves them under `/slides/` instead.

A site that renders `.md` as MDX must treat it as CommonMark, or the `deck:` comments are a build error: `markdown: { format: 'detect' }`.
