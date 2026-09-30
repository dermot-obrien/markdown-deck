<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# markdown-deck

An agent skill that turns tagged sections of one Markdown document into HTML slides and a PDF, keeping the Markdown as the only source. The tags are HTML comments, so the document still reads as a document wherever Markdown renders, and untagged sections stay document-only.

It is an [Agent Skill](https://agentskills.io/specification), so any agent that reads the format can use it, and a plain Node CLI that anyone can run. It needs no other skill and no particular repository layout.

## Documentation

| Guide | What it covers |
|---|---|
| [Quick start](docs/quick-start.md) | From nothing to a first deck, HTML and PDF, in about ten minutes |
| [Tag reference](docs/tags.md) | Every tag and every attribute it takes, slide ids and addresses, and what happens to links and files in a slide |
| [Concepts](docs/concepts.md) | Tags, themes, palettes and named colour schemes, background images, includes, designed slides, review comments, publishing and the registry |
| [Configuration reference](docs/configuration.md) | Every repository binding and front matter key, with its default, type, precedence and an example |
| [Command reference](docs/commands.md) | `build`, `pdf`, `publish`, `themes` and the post-install check, with every option |
| [Troubleshooting](docs/troubleshooting.md) | What each error and warning means, and what to do |
| [SKILL.md](skills/markdown-deck/SKILL.md) | The instructions an agent follows |
| [CHANGELOG](CHANGELOG.md) | What changed in each release |

## Install

The skill is the directory `skills/markdown-deck/`. Put it where your agent reads skills, then run `npm install` in it once.

### Where each agent reads skills

| Agent | This project only | Every project |
|---|---|---|
| VS Code with GitHub Copilot | `.github/skills/`, `.agents/skills/` or `.claude/skills/` | `~/.copilot/skills/` |
| Cursor | `.agents/skills/`, `.cursor/skills/` or `.claude/skills/` | `~/.cursor/skills/` |
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Codex | `.agents/skills/` | `~/.agents/skills/` |
| Gemini CLI | `.agents/skills/` | `~/.agents/skills/`, or `gemini skills install --scope user` |
| Amp, Zed, Windsurf, Cline and others | `.agents/skills/` | `~/.agents/skills/` |

`.agents/skills/` is the widest-read project folder. Claude Code does not read it, so a project used with Claude Code as well keeps a copy, or a link, in `.claude/skills/`. `~` is your home folder: `$HOME` in bash, `$env:USERPROFILE` in PowerShell.

### With the GitHub CLI

```bash
gh skill install dermot-obrien/markdown-deck markdown-deck --agent github-copilot
```

`--agent` takes `github-copilot`, `claude-code`, `cursor`, `codex`, `gemini-cli` and others; `--scope user` installs for every project, and `--pin markdown-deck--v0.6.4` locks it to a release tag. It needs GitHub CLI 2.90 or later. `gh skill preview dermot-obrien/markdown-deck markdown-deck` shows the skill first. Then run `npm install` in the installed skill directory.

### By copying

Into the project's `.agents/skills/`. For another folder, change the destination to one from the table.

PowerShell:

```powershell
git clone --depth 1 https://github.com/dermot-obrien/markdown-deck.git "$env:TEMP\markdown-deck"
New-Item -ItemType Directory -Force .agents\skills | Out-Null
Copy-Item -Recurse "$env:TEMP\markdown-deck\skills\markdown-deck" .agents\skills\
npm install --prefix .agents/skills/markdown-deck
```

bash:

```bash
git clone --depth 1 https://github.com/dermot-obrien/markdown-deck.git /tmp/markdown-deck
mkdir -p .agents/skills
cp -R /tmp/markdown-deck/skills/markdown-deck .agents/skills/
npm install --prefix .agents/skills/markdown-deck
```

For every project, copy to a user-level folder instead, such as `"$env:USERPROFILE\.agents\skills\"` in PowerShell or `~/.agents/skills/` in bash, and run `npm install --prefix` on that copy.

### Other installers

```bash
npx skills add dermot-obrien/markdown-deck/skills/markdown-deck
gemini skills install https://github.com/dermot-obrien/markdown-deck.git --path skills/markdown-deck --scope user --consent
```

### Claude Code, as a plugin

The repository is also a Claude Code plugin marketplace, which lets other plugins, such as [architecture-pattern](https://github.com/dermot-obrien/architecture-pattern), depend on it by version:

```
/plugin marketplace add dermot-obrien/markdown-deck
/plugin install markdown-deck@markdown-deck
```

### Pinned in your own repository

For a regulated or air-gapped consumer who needs an exact commit. Releases are tagged `markdown-deck--v<version>`:

```bash
git subtree add --prefix .agents/skills/markdown-deck https://github.com/dermot-obrien/markdown-deck markdown-deck--v0.6.4 --squash
```

### Requirements

- Node 18 or newer. `npm install` in the skill fetches `gray-matter`, `marked` and [Playwright](https://playwright.dev/).
- Playwright is optional and used only for the PDF. It downloads no browser: the exporter drives Microsoft Edge, then Google Chrome, then Playwright's own Chromium, so Windows needs nothing more. Elsewhere, install Chrome or run `npx playwright install chromium`. If a proxy blocks Playwright, everything except the PDF still works.

Check an install from the workspace root with `node <skill>/bin/check.mjs`, which prints `markdown-deck: ok`.

## Quick start

Tag a document, `talk.md`:

```markdown
# Shipping Smaller

<!-- deck:cover subtitle="Why small releases win" -->

<!-- deck:slide -->
## The problem

Large releases hide risk until the day they ship.

## Appendix

No tag, so this stays in the document.
```

Build it:

```bash
node .agents/skills/markdown-deck/bin/markdown-deck.mjs build talk.md --out dist --pdf
```

`dist/deck.html` opens from disk: a slide index down the left, the arrow keys to move, `F` to present. `dist/deck.pdf` has one 16:9 page per slide. Or ask your agent to make a deck from the document. The [quick start](docs/quick-start.md) goes step by step, including a colour scheme and a background image, and `npm run example` in the skill directory builds the skill's own worked example.

Repository-wide defaults, such as a theme, a colour scheme or a background image, live in `[suite.markdown-deck]` of `.agents/skill-bindings.toml`:

```toml
[suite.markdown-deck]
palette    = "dusk"
background = { image = "art/texture.png", slides = "content", wash = 0.85 }

[suite.markdown-deck.palettes.dusk]
heading  = "#3b2f5c"
cover-bg = "#1f1a2e"
```

A deck overrides any of them in its front matter (`deck_palette`, `deck_background`), and a build on the command line (`--palette`, `--background`). See the [configuration reference](docs/configuration.md).

## Repository layout

```
markdown-deck/
├── skills/markdown-deck/      the skill: the only directory an installer copies
│   ├── SKILL.md               the skill definition, Agent Skills format
│   ├── LICENSE, LICENSES/, NOTICE   carried inside so a copied directory is complete
│   ├── package.json           npm package, exposes the markdown-deck bin
│   ├── inputs.toml            the repository defaults it accepts
│   ├── bin/                   markdown-deck.mjs, the CLI; check.mjs, the post-install check
│   ├── src/                   build, parsing, rendering, PDF, publishing
│   ├── tests/
│   ├── themes/
│   └── examples/
├── docs/                      the guides above
├── .claude-plugin/            one Claude Code package per skill
├── bundle.json                the bundle manifest
├── scripts/                   skill and bundle validators, run in CI
├── LICENSE, LICENSES/, NOTICE, REUSE.toml
├── CHANGELOG.md
└── README.md
```

The skill is nested under `skills/` so that repository scaffolding, these docs included, stays out of the directory that lands in every consumer's context window, and because `gh skill`, `npx skills`, `gemini skills install --path` and Claude Code plugins all resolve that path natively.

## Dependencies

markdown-deck has no skill dependencies. The optional `model` skill from [diagram-model](https://github.com/dermot-obrien/diagram-model), installed where an agent reads skills, adds two things: `model doctor --skill markdown-deck` checks a repository's defaults against `inputs.toml`, and `build --refresh` re-renders a stale diagram image. Neither is needed to build a deck.

If the skill gains a dependency, the convention is `metadata.x-skill-requires: "pkg:generic/<owner>/<bundle>/some-skill ^1.2.0"` in `SKILL.md`, repeated under `dependencies` in the skill's entry in `.claude-plugin/marketplace.json`, which is the route that enforces it.

## Testing

```sh
npm test
```

Node's built-in test runner, no extra dependency. `tests/parse`, `tests/render` and `tests/build` need nothing else. `tests/browser` drives a real browser to check what a unit test cannot: that the canvas is 16:9 at any window size, that every slide is fitted including the ones not on screen, and that the PDF has one 16:9 page per slide. It uses Edge, then Chrome, then Playwright's Chromium, or `MARKDOWN_DECK_BROWSER`, and skips where none can be launched.

## Compatibility notes

`SKILL.md` carries only fields the Agent Skills specification defines: `name`, `description`, `license`, `compatibility` and `metadata`. It leaves out the sixth, `allowed-tools`, which the specification marks experimental. Tool-specific frontmatter is deliberately absent, because several tools reject unknown fields on upload and none of them mean the same thing across implementations. Any tool-specific behaviour belongs in an overlay applied at install time, not in this file.

## Agent Skills conformance

`markdown-deck` conforms to the [Agent Skills specification](https://agentskills.io/specification). Its `SKILL.md` carries only the fields the specification defines, its `name` is the name of the directory it is installed into (`skills/markdown-deck` here, and `markdown-deck` under whichever skills directory an installer uses), every `metadata` value is a string, and the file stays within the specification's guidance of 500 lines and 5,000 tokens, with detail in files it links by a relative path one level deep. The `x-` keys in `metadata` are this project's own, which the specification allows.

CI checks this on every pull request and every push to `main`, with `skills-ref`, the specification's reference validator, beside this repository's own `scripts/validate-skills.mjs`, which also checks that relative links resolve. To run the same checks locally, from the repository root:

```bash
python -m pip install "git+https://github.com/agentskills/agentskills@69ef37e9424c0a7ea9dd2293b559e43ec8176379#subdirectory=skills-ref"
skills-ref validate skills/markdown-deck
node scripts/validate-skills.mjs skills
```

On Windows, set `PYTHONUTF8=1` before running `skills-ref`, which otherwise reads `SKILL.md` in the system's code page.

## Versions and identifiers

The skill is identified by a Package URL of the `generic` type, `pkg:generic/dermot-obrien/markdown-deck/markdown-deck`, which names no host, so a mirror or a move changes where it is fetched from but not what it is called. It has its own Semantic Version in `SKILL.md` (`metadata.version`), and each release is tagged `markdown-deck--v<version>`. A skill that needs this one declares it as `pkg:generic/dermot-obrien/markdown-deck/markdown-deck ^0.6.0`. This follows DD-11 of [AI-Assisted Work](https://github.com/dermot-obrien/ai-assisted-work/blob/main/docs/about/design-decisions.md).

## Origin

markdown-deck was developed as a skill of [AI-Assisted Work](https://github.com/dermot-obrien/ai-assisted-work), by the same author, and was extracted into this repository on 2026-09-29 at version 0.5.1 so it can be used without that framework. [NOTICE](./NOTICE) records the exact source commit; the history before extraction is the history of `skills/markdown-deck` there.

## Licence

Content (this README, `SKILL.md`, themes and examples) is licensed under [CC BY 4.0](LICENSES/CC-BY-4.0.txt), and code under [Apache-2.0](LICENSES/Apache-2.0.txt), the same terms as AI-Assisted Work. See [LICENSE](./LICENSE) for which files are which, and keep [NOTICE](./NOTICE) with any copy or derivative.
