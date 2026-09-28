# Contributing to markdown-deck

Thank you for your interest in contributing. Bug reports, fixes, themes, examples and documentation improvements are all welcome.

## Ways to contribute

- Report a bug or a rendering problem, with the smallest Markdown document that shows it.
- Suggest an improvement to the tag vocabulary, the deck chrome or the PDF export.
- Fix a bug or add a feature, with tests.
- Improve the documentation or the example.

## Process

For a small change, fork the repository, make the change and open a pull request.

For a significant change, open an issue first describing what you want to do, so it can be discussed before you invest in it. Then fork, develop and open a pull request that references the issue.

## Before you open a pull request

Run, from the repository root:

```bash
node scripts/validate-skills.mjs skills
cd skills/markdown-deck && npm install && npm test
```

The browser tests are skipped unless `playwright` is installed and a browser can be launched. Install it with `npm install --no-save playwright` to run them.

Keep the skill generic. It is used by many organisations, so nothing in it may name or imply one: no organisation names, internal hosts or brand palettes in code, themes, tests or examples. An organisation's own theme or palette belongs in its own repository, bound through `[suite.markdown-deck]` of its `.agents/skill-bindings.toml`.

Record a user-visible change in `CHANGELOG.md` and raise the version in `skills/markdown-deck/package.json`, `skills/markdown-deck/SKILL.md` (`metadata.version`) and `.claude-plugin/plugin.json` and `marketplace.json` together.

## Releases

A release is a commit on `main` whose versions all agree, tagged twice: `markdown-deck--v<version>`, which Claude Code resolves plugin dependency ranges against, and `v<version>`, which `gh skill install` and people read. `claude plugin tag` creates the first and checks that the manifests agree.

## Licensing of contributions

This repository is dual-licensed:

- Content (Markdown, skill instructions, themes, examples): [CC BY 4.0](LICENSES/CC-BY-4.0.txt)
- Code (`bin/`, `src/`, `tests/`, `scripts/`, package and plugin manifests, CI workflows): [Apache-2.0](LICENSES/Apache-2.0.txt)

By submitting a contribution (pull request, patch, or issue containing code), you agree that it is licensed under the same terms as the file you are modifying. New code files must include an SPDX header:

```javascript
// SPDX-FileCopyrightText: <year> <your name or organisation>
// SPDX-License-Identifier: Apache-2.0
```

New content files are covered by the bulk rules in `REUSE.toml` and need no header. The project follows the [REUSE Specification 3.3](https://reuse.software/spec-3.3/).

## Derivative works

If you fork this repository or build on it:

1. Keep `LICENSE`, `LICENSES/`, `NOTICE` and `REUSE.toml` intact, and add your own attribution to `NOTICE` rather than replacing it.
2. Preserve the `SPDX-FileCopyrightText` and `SPDX-License-Identifier` headers in the files you carry over.
3. Mention "Based on markdown-deck by Dermot O'Brien, derived from AI-Assisted Work" in your README, and link to this repository.
4. Indicate the changes you have made, as both CC BY 4.0 and Apache-2.0 require.

## Code of conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions

Open an [issue](https://github.com/dermot-obrien/markdown-deck/issues).
