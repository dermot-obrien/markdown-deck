<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Quick start

From nothing to a first deck, as HTML and as a PDF, in about ten minutes. You will install the skill into a new project, write a short document, build it, then give it a colour scheme and a background image.

Commands are given for PowerShell on Windows and for bash on macOS, Linux or Git Bash where they differ. Where only one block is shown, it works in both.

## 1. Check the prerequisites

```bash
node --version
git --version
```

You should see `v18` or later for Node, and any version of Git. If Node is missing, install the LTS release from [nodejs.org](https://nodejs.org/).

PDF export also needs a browser. Windows always has Microsoft Edge, which is used first; elsewhere, Google Chrome is used if it is installed.

## 2. Make a project folder

PowerShell:

```powershell
New-Item -ItemType Directory -Force talk | Out-Null
Set-Location talk
```

bash:

```bash
mkdir -p talk && cd talk
```

## 3. Install the skill into the project

The skill goes in `.agents/skills/`, the project folder most agents read skills from. The [README](../README.md#install) lists the folder for each agent, and the user-level folders that install it for every project.

PowerShell:

```powershell
git clone --depth 1 https://github.com/dermot-obrien/markdown-deck.git "$env:TEMP\markdown-deck"
New-Item -ItemType Directory -Force .agents\skills | Out-Null
Copy-Item -Recurse "$env:TEMP\markdown-deck\skills\markdown-deck" .agents\skills\
```

bash:

```bash
git clone --depth 1 https://github.com/dermot-obrien/markdown-deck.git /tmp/markdown-deck
mkdir -p .agents/skills
cp -R /tmp/markdown-deck/skills/markdown-deck .agents/skills/
```

If `git clone` says the destination already exists, delete that folder from an earlier attempt and run the block again.

## 4. Install its dependencies and check the install

```bash
npm install --prefix .agents/skills/markdown-deck
node .agents/skills/markdown-deck/bin/check.mjs
```

`npm install` takes seconds to a minute. It fetches two packages for reading Markdown and Playwright for the PDF, about a dozen packages in all, and downloads no browser. The check should print:

```
markdown-deck: ok
```

## 5. Write a document

Create `talk.md` in the project folder. Paste the block for your shell, or save the text between the markers in an editor.

PowerShell:

```powershell
@'
---
title: Shipping Smaller
---

# Shipping Smaller

<!-- deck:cover subtitle="Why small releases win" date="Team briefing" -->

This paragraph is for readers of the document only. It has no tag, so no slide shows it.

<!-- deck:slide -->
## The problem

Large releases hide risk until the day they ship.

- Every change waits for the slowest one
- A failure is hard to trace to its cause

<!-- deck:slide -->
## What we will do

| Now | Next |
|---|---|
| Monthly release | Weekly release |
| Manual checks | Automated checks |

<!-- deck:note -->
Mention the pilot team here.
<!-- /deck:note -->

## Appendix

No tag, so this stays in the document.
'@ | Set-Content -Encoding utf8 talk.md
```

bash:

```bash
cat > talk.md <<'EOF'
---
title: Shipping Smaller
---

# Shipping Smaller

<!-- deck:cover subtitle="Why small releases win" date="Team briefing" -->

This paragraph is for readers of the document only. It has no tag, so no slide shows it.

<!-- deck:slide -->
## The problem

Large releases hide risk until the day they ship.

- Every change waits for the slowest one
- A failure is hard to trace to its cause

<!-- deck:slide -->
## What we will do

| Now | Next |
|---|---|
| Monthly release | Weekly release |
| Manual checks | Automated checks |

<!-- deck:note -->
Mention the pilot team here.
<!-- /deck:note -->

## Appendix

No tag, so this stays in the document.
EOF
```

The tags are HTML comments, so `talk.md` still reads as a normal document on GitHub or in any Markdown viewer.

## 6. Build the deck and the PDF

```bash
node .agents/skills/markdown-deck/bin/markdown-deck.mjs build talk.md --out dist --pdf
```

You should see three lines; on macOS and Linux the paths use `/`:

```
  2 slide(s) + cover -> dist\deck.html
  browser: msedge
  dist\deck.pdf (36 KB)
```

The browser line names whichever browser printed the PDF, and the size varies a little. `dist` now holds `deck.html`, `deck.pdf` and `manifest.json`. A deck with images also gets an `assets` folder.

## 7. Open it

PowerShell:

```powershell
Start-Process dist\deck.html
Start-Process dist\deck.pdf
```

bash, on macOS use `open`; on Linux, `xdg-open`:

```bash
open dist/deck.html
open dist/deck.pdf
```

In the browser you should see the cover, "Shipping Smaller", on a dark ground, with a slide index down the left listing three slides. Use the arrow keys to move, `I` to hide the index and `F` to present full screen. The appendix and the untagged paragraph are not there, and neither is the note. The PDF has three 16:9 pages.

## 8. Add a colour scheme and a background

Repository defaults live in `.agents/skill-bindings.toml`. This one names two colour schemes, picks one, and puts a soft texture behind every slide but the cover.

PowerShell:

```powershell
New-Item -ItemType Directory -Force .agents\art | Out-Null
@'
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#9ec5e8"/><stop offset="1" stop-color="#f3d9a4"/>
  </linearGradient></defs>
  <rect width="1920" height="1080" fill="url(#g)"/>
</svg>
'@ | Set-Content -Encoding utf8 .agents\art\texture.svg
@'
[suite.markdown-deck]
palette = "dusk"
background = { image = "art/texture.svg", slides = "content", wash = 0.6 }

[suite.markdown-deck.palettes.dusk]
heading = "#3b2f5c"
accent = "#8f7bb8"
cover-bg = "#1f1a2e"

[suite.markdown-deck.palettes.meadow]
heading = "#2e5e3a"
accent = "#7fae6b"
cover-bg = "#1c3324"
'@ | Set-Content -Encoding utf8 .agents\skill-bindings.toml
```

bash:

```bash
mkdir -p .agents/art
cat > .agents/art/texture.svg <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#9ec5e8"/><stop offset="1" stop-color="#f3d9a4"/>
  </linearGradient></defs>
  <rect width="1920" height="1080" fill="url(#g)"/>
</svg>
EOF
cat > .agents/skill-bindings.toml <<'EOF'
[suite.markdown-deck]
palette = "dusk"
background = { image = "art/texture.svg", slides = "content", wash = 0.6 }

[suite.markdown-deck.palettes.dusk]
heading = "#3b2f5c"
accent = "#8f7bb8"
cover-bg = "#1f1a2e"

[suite.markdown-deck.palettes.meadow]
heading = "#2e5e3a"
accent = "#7fae6b"
cover-bg = "#1c3324"
EOF
```

The image path is relative to the bindings file. Check the bindings, then build again:

```bash
node .agents/skills/markdown-deck/bin/check.mjs
node .agents/skills/markdown-deck/bin/markdown-deck.mjs build talk.md --out dist --pdf
```

The check prints `markdown-deck: ok`. Reload `deck.html`: the cover turns a dark purple, the slide headings and the table header turn purple, and the two content slides sit on a pale blue-to-sand gradient. `dist/assets` now holds `texture.svg`, and the PDF shows the same.

Try the other scheme for one build, then without any scheme:

```bash
node .agents/skills/markdown-deck/bin/markdown-deck.mjs build talk.md --out dist --palette meadow
node .agents/skills/markdown-deck/bin/markdown-deck.mjs build talk.md --out dist --palette none --background none
```

Reload `deck.html` after each. The first gives green headings and a dark green cover, on the same background. The second is the plain default theme with no background. Without `--pdf`, only `deck.html` changes. The same choices can live in the document's front matter, as `deck_palette: meadow` and `deck_background: none`.

## 9. Let your agent do it

Open the project in your agent, such as VS Code with GitHub Copilot, Cursor, Claude Code, Codex or Gemini CLI, and ask:

> Make a deck from talk.md and give me the PDF.

The agent finds the skill in `.agents/skills/markdown-deck`, adds or adjusts the tags, runs the build and reports the slide count and the paths. Claude Code reads `.claude/skills/` rather than `.agents/skills/`; copy the skill there too, as the [README](../README.md#install) describes.

## Next

- [Tag reference](tags.md): every tag and every attribute it takes.
- [Concepts](concepts.md): how tags, themes, palettes, backgrounds, includes, review comments and publishing work.
- [Configuration reference](configuration.md): every binding and front matter key.
- [Command reference](commands.md): every command and option.
- [Troubleshooting](troubleshooting.md): what each error and warning means.
