<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Tag reference

Every tag, where it goes, and every attribute it takes. For why the tags work as they do, see [Concepts](concepts.md#tags).

- [How tags are written](#how-tags-are-written)
- [deck:cover](#deckcover)
- [deck:slide](#deckslide)
- [deck:divider](#deckdivider)
- [deck:image](#deckimage)
- [deck:html](#deckhtml)
- [deck:include](#deckinclude)
- [deck:skip](#deckskip)
- [deck:note](#decknote)
- [Slide ids and addresses](#slide-ids-and-addresses)
- [What happens to links and files in a slide](#what-happens-to-links-and-files-in-a-slide)

## How tags are written

A tag is an HTML comment whose text starts with `deck:`, so it is invisible wherever the Markdown renders:

```markdown
<!-- deck:slide label="Interfaces" -->
```

- Put each tag on its own line, with a blank line before and after it.
- Attributes are `name="value"`, in double quotes. Single quotes and bare values are not read. A value cannot contain a double quote.
- Attribute names are case-sensitive and lower case. An attribute the tag does not take is ignored, not reported.
- A `true` attribute, such as `header="true"`, must say `true`; any other value means false.
- Slides appear in the order their tags appear in the document.
- A tag inside a `deck:skip` block is ignored, and so is a tag inside a fenced code block, which is how this page shows them.

## deck:cover

```markdown
# Shipping Smaller

<!-- deck:cover subtitle="Why small releases win" date="Team briefing" -->
```

The cover slide, always first. It is titled by the document's title: `--title`, else `title` in the front matter, else `sidebar_label`, else the file name. Place it anywhere; after the H1 is usual. Only the first `deck:cover` in a document is used.

| Attribute | Meaning | Default |
|---|---|---|
| `subtitle` | The line under the title | `description` in the front matter, else none |
| `date` | A small line, such as a date or an audience | none |
| `footnote` | A small line at the foot of the cover | none |
| `logo` | An image on the cover, as a path relative to the output folder | none |

`--subtitle`, `--date`, `--footnote` and `--logo` override these for one build. The cover's address is `#cover`.

## deck:slide

```markdown
<!-- deck:slide label="Interfaces" table-rows="20" -->
## The interfaces we expose
```

The next heading's section becomes one slide. The section runs from that heading to the next heading of the same or higher level, so a `##` section takes its `###` subsections with it. The tag attaches to the heading after it, never the one before.

| Attribute | Meaning | Default |
|---|---|---|
| `label` | The slide's entry in the index, and the source of its id | the heading text |
| `title` | The title shown on the slide | the heading text |
| `eyebrow` | The small line above this slide's title; `eyebrow=""` removes it | the deck's eyebrow |
| `table-rows` | Rows a table may carry before it continues on the next slide; `0` never splits | `deck_table_rows`, `tableRows`, else 12 |

A slide whose section is empty, once skipped text and notes are removed, is dropped with a warning. A table longer than the limit continues on further slides titled "Title (2 of 3)" and so on; see [Long tables](concepts.md#long-tables).

## deck:divider

```markdown
<!-- deck:divider eyebrow="Part 2" subtitle="What we will build" -->
## Delivery
```

A section divider, on the cover's ground. Before a heading, it is titled by that heading, and the heading's section stays in the document only. With `title`, the tag stands alone anywhere.

| Attribute | Meaning | Default |
|---|---|---|
| `title` | The divider's title; lets the tag stand without a heading | the next heading |
| `subtitle` | A line under the title | none |
| `eyebrow` | A small line above the title, such as "Part 2". A divider never takes the deck's eyebrow | none |
| `label` | The divider's entry in the index, and the source of its id | the title |

## deck:image

```markdown
<!-- deck:image src="./exported/roadmap.png" title="The roadmap" -->
```

A whole slide from a finished image, such as a slide exported from another tool. The image fills the 16:9 canvas.

| Attribute | Meaning | Default |
|---|---|---|
| `src` | The image, relative to the document. Required | |
| `title` | The slide's title, used in the index | `label`, else the file name |
| `label` | The index entry, and the source of the id | the title |
| `header` | `true` shows the deck's header and title above the image; otherwise the title is a small tag in a corner | false |

Use a PNG at 1920x1080 or larger. The build warns about an image that is not 16:9, which is letterboxed, or smaller than 1920x1080, which looks soft on a projector. A missing image skips the slide with a warning.

## deck:html

```markdown
<!-- deck:html src="./slides/timeline.html" title="The timeline" header="true" -->
```

A whole slide from a self-contained HTML file drawn on the 1920x1080 canvas, for a layout Markdown cannot express. It is shown in a frame, so its styles and scripts cannot reach the deck.

| Attribute | Meaning | Default |
|---|---|---|
| `src` | The HTML file, relative to the document. Required | |
| `title` | The slide's title | `label`, else the file name |
| `label` | The index entry, and the source of the id | the title |
| `header` | `true` shows the deck's header and title above the frame | false |
| `eyebrow` | With `header="true"`, the small line above the title | the deck's eyebrow |

The files the HTML loads, `src` and `poster` on any tag, stylesheet links and CSS `url(...)`, are copied into `assets/`. Anything it loads from the network is warned about. An HTML slide's text is not in the document, so prefer Markdown where it will do.

## deck:include

```markdown
<!-- deck:include src="../methodology/playbook.md" section="Stage 1: budget" -->
<!-- deck:include deck="fy30-plan" slide="interfaces" title="Interfaces, from the plan" -->
```

A section of another document, rendered at build time in this deck's theme. The source need not be a deck.

| Attribute | Meaning | Default |
|---|---|---|
| `src` | The source document, relative to this one | |
| `deck` | Instead of `src`: a published deck, by its `deck_id`, found anywhere in the workspace | |
| `section` | The heading to take, ignoring case and surrounding space | |
| `slide` | Instead of `section`: a slide the source already tags, by its id | |
| `title` | The slide's title | the source heading |
| `label` | The index entry, and the source of the id | `title`, else the source heading |
| `eyebrow` | The small line above the title; `eyebrow=""` removes it | `From <source title>` |
| `header` | `true` keeps the header layout for a section that is only an image | false |

One of `src` and `deck`, and one of `section` and `slide`, are required; without them the tag is skipped with a warning. A missing file, deck, section or slide fails the build, and the message lists what exists. Images, links and reference definitions in the section resolve against the source document. A section that is nothing but an image is shown full-bleed, like `deck:image`, unless `header="true"`.

## deck:skip

```markdown
<!-- deck:skip -->
Detail for readers of the document only.
<!-- /deck:skip -->
```

Everything between the two comments stays in the document and is dropped from the deck, including any tags inside it. Use it inside a tagged section to keep a slide short, or around a whole appendix. It takes no attributes.

## deck:note

```markdown
<!-- deck:note -->
Mention the pilot team here.
<!-- /deck:note -->
```

Presenter notes, inside a tagged section. They are never shown on a slide, in the deck's viewer or in the PDF. They are kept in the deck's HTML, in a hidden `<aside class="notes">` element on their slide, for a host or a script that wants them. After a table splits across slides, notes stay with the first. It takes no attributes.

## Slide ids and addresses

Every slide has an id, and the deck's address shows it: `deck.html#interfaces`. An id is a slug of the slide's `label`, or of its title where there is no label: lower case, with every run of other characters turned into one hyphen. Two slides with the same id become `interfaces` and `interfaces-2`. The cover is `cover`. A table split across slides keeps the id on its first slide; the others are numbered on, such as `interfaces-2`.

Links to a slide survive slides being added or reordered, as long as its label or title does not change. Give a slide a `label` when its heading may be reworded but links to it must hold. A plain number, `deck.html#3`, still opens the third slide, for links made before ids existed.

## What happens to links and files in a slide

| In a slide | At build time |
|---|---|
| A local image, `![alt](./pic.png)` | Copied into `assets/`, and the path rewritten. Missing: warned about and left as written |
| `src` or `poster` on an HTML tag, such as `<video src="./demo.mp4">` | Copied into `assets/` the same way. A file over 50 MB is warned about |
| A link to another Markdown document, `[x](./guide.md#setup)` | With `documentBase`, to that document's published page; without, to the source file by a path from the deck. See [documentBase](configuration.md#documentbase) |
| A link to any other local file, such as a spreadsheet | Left as written, so it works only where the deck sits beside that file |
| A URL, or a link within the page such as `#setup` | Left as written |
| A reference link, `[text][label]` | Resolved on every slide, against definitions anywhere in the document, usually its foot |
| A mermaid fence | Drawn as a diagram; see [Diagrams](concepts.md#diagrams-mermaid-and-rendered-images) |
