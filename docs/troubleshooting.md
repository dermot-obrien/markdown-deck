<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Troubleshooting

Messages are shown as the CLI prints them. An error stops the build and is printed as `  ! <message>`; a warning is printed the same way, the build continues, and a count follows. Search this page for the start of the message; each heading is the message, with the parts that vary in angle brackets.

## Install and environment

### `gray-matter, marked not installed. Run npm install in <skill>.`

From `check.mjs`. Run `npm install` in the skill directory once after installing or updating the skill.

### `warning: playwright is not installed, so PDF export is unavailable.`

Everything except PDF export works. Run `npm install` in the skill; if a proxy blocks Playwright, the install still succeeds without it.

### `PDF export needs playwright, an optional dependency of this skill that is not installed.`

As above, when `--pdf` or the `pdf` binding asks for a PDF.

### `no usable browser.`

Playwright found no Edge, Chrome or bundled Chromium. Install Chrome, or run `npx playwright install chromium` in the skill, or set `MARKDOWN_DECK_BROWSER` to a browser's path.

### `Node.js <version> is too old: markdown-deck needs 18 or newer.`

Install Node 18 or later.

## Building

### `<input> carries no deck: tags.`

The document has no `deck:cover`, `deck:slide`, `deck:image` or `deck:html` tag. Add at least one; see [Tags](concepts.md#tags).

### `input not found: <path>`

The path to the Markdown file is wrong, relative to the working directory.

### `deck:slide tag at offset <n> has no heading after it`

A `deck:slide` tag attaches to the next heading. Move it to just before one.

### `slide "<label>" is empty after deck:skip removal; skipped`

The tagged section has nothing left once skipped text and notes are removed. Untag it, or give it content.

### `image not found, left as-is: <path>`

A Markdown image's file does not exist, relative to the document. Correct the path.

### `image slide "<label>" skipped: <src> not found` and `html slide "<label>" skipped: <src> not found`

The file a `deck:image` or `deck:html` tag names does not exist, relative to the document.

### `image slide "<label>" is <w>x<h>, not 16:9; it will be letterboxed`

Export the image at 16:9, ideally 1920x1080.

### `html slide "<label>" loads <n> resource(s) from the network`

The HTML slide uses a CDN or web font, so it is incomplete offline. Copy those files beside the HTML and reference them relatively.

### `<file> is <n> MB; a deck this heavy is slow to open and to publish`

Compress the media, or link to it instead.

### `no such theme: <name>. Available: default`

`--theme`, `deck_theme` or `theme` names neither a built-in theme nor a `.css` file that exists.

### `deck:include src="<path>": no such file`, `no section headed "<heading>"`, `no slide "<id>"`, `deck:include deck="<id>": no published deck has that id`

The include's target moved or was renamed. The message lists what does exist.

### `stale render: <image>, because <diagram> has changed since it was rendered. Re-render with: <command>`

Run the printed command, or build with `--refresh`. With `CI` set this is an error.

### `mermaid not found at <path>; loading it from <CDN>`

The `mermaid` binding or `--mermaid` names a file that does not exist.

## Palettes and colour schemes

### `unknown palette token: <key>. Known tokens: ...`

A palette, `deck_palette` table or scheme uses a key that is not a token. Correct the spelling; the message lists every token.

### `[suite.markdown-deck] palettes in <file>.<scheme>: unknown palette token: <key>`

The same, in a named scheme. Every build in the repository stops until it is fixed.

### `<where>: no palette named "<name>". Known: <schemes>, or none`

`palette`, `deck_palette` or `--palette` names a scheme that is not in `palettes`. `<where>` says which setting, and in which file.

### `no palette named "<name>". Name schemes in [suite.markdown-deck.palettes] first, or give a table of tokens`

A palette was given by name, but the repository defines no schemes.

### `<where> must be a table of named palettes` and `<where>.<scheme> must be a table of palette tokens`

`palettes` holds each scheme as a sub-table, `[suite.markdown-deck.palettes.<name>]`, not a string.

## Background images

### `<where>: background image <path> not found (<full path>)`

The image does not exist. `<where>` says which setting it came from: `--background` resolves against the working directory, `deck_background in <doc>` against the document, and `[suite.markdown-deck] background in <file>` against the binding file.

### `<where>: <path> is not a supported image type. Use png, jpg, jpeg, svg, webp`

Convert the image to one of those.

### `<where>: image is required, a path to a png, jpg, jpeg, svg, webp file`

A background table has no `image`.

### `<where>: slides is "<value>"; expected one of all, cover, content`, `fit is "<value>"; expected one of cover, contain, repeat`, `wash is <value>; expected a number from 0 to 1`, `position "<value>" is not a CSS background-position`, `unknown key <key>`

Correct the value named.

### `the background is for the cover only, and this deck has no deck:cover`

A warning. Add a cover, or use `slides = "all"` or `"content"`.

### The background shows in the browser but text is hard to read

Raise `wash` towards 1, or use `slides = "cover"` and keep content slides plain.

## Bindings

### `<file>:<line>: unsupported value "<text>"; use a quoted string, true, false, a number or an inline table`

The binding reader is small. Quote strings, and write tables as `[suite.markdown-deck.<name>]` sections or `{ key = value }`.

### `<file>:<line>: unterminated string` and `unterminated inline table`

A closing quote or `}` is missing on that line.

### `theme <name> is neither a built-in theme (...) nor a .css file that exists`, `registry <path> is in a folder that does not exist`

From `check.mjs`. Correct the path; binding paths resolve against the binding file.

### A setting in the binding has no effect

The nearest `.agents/skill-bindings.toml` at or above the document is used; a closer one hides one further up. The section must be exactly `[suite.markdown-deck]`. Front matter and options override the binding.

## Publishing

### `<doc>: deck_publish is set but deck_id "<id>" is missing or not lower-case-hyphenated`

Give the document a `deck_id` such as `fy30-plan`.

### `<doc>: deck_id "<id>" is already used by <other>` and `is reserved by something else at /decks/<id>/`

Choose another id.

### `<doc>: deck_publish is set but the document has no deck: tags`

Tag it, or remove `deck_publish`.

### `/decks/<id>/ (<doc>) is not in the published-deck registry. Run the publish step locally and commit the registry.`

In CI, or with `--registry-check`, new decks are not recorded. Publish locally and commit the registry file.

### `/decks/<id>/ was published from <doc> and no longer is, so links to it would break.`

Restore the deck, or mark its registry entry `"status": "retired"`, or `"status": "redirected"` with `"redirect": "<deck_id>"`.

### `publish: need --out <dir>`

`publish` has no default output folder.

## The PDF

### `slide <n> "<title>" shrunk to <nn>% to fit; consider splitting it or moving detail into deck:skip`

The slide is legible on screen and hard to read projected. Split it, or move detail into `deck:skip`.

### The PDF is missing a background or image that the HTML shows

Update to 0.6.5 or later, which waits for background images before printing. Check that the file is in `assets/`.
