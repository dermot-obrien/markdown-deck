// SPDX-License-Identifier: Apache-2.0
// Links from a slide to another document of the workspace: to its published page with
// documentBase, else to its source file by a path from the deck.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build, documentRoute, documentUrl } from '../src/index.mjs';
import { rewriteLinks } from '../src/parse.mjs';

let dir;
const write = (name, text) => {
  const p = path.join(dir, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  return p;
};

const DOC = `---
title: "Linking Deck"
---

# Linking Deck

<!-- deck:slide -->
## Links

See [the research](./research.md#findings), [the guide](../guides/index.md),
[the notes][notes], [a missing one](./gone.md), [a sheet](./data.csv),
[a page](https://example.com/a.md), [a heading](#links) and
<a href="./research.md">the research again</a>.

\`\`\`
[in code](./research.md)
\`\`\`

[notes]: ./notes/README.md
`;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-links-'));
  write('guides/index.md', '# Guides\n');
  write('topic/research.md', '# Research\n');
  write('topic/notes/README.md', '# Notes\n');
  write('topic/data.csv', 'a,b\n');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const deck = (opts = {}) => {
  const warnings = [];
  const src = write('topic/deck.md', DOC);
  const r = build(src, { out: path.join(dir, 'out', 'linking'), root: dir, onWarn: (m) => warnings.push(m), ...opts });
  return { html: r.deckHtml, warnings };
};

test('with documentBase, links to documents go to their pages', () => {
  const { html, warnings } = deck({ documentBase: '/site/' });
  assert.match(html, /href="\/site\/topic\/research\/#findings"/);
  assert.match(html, /href="\/site\/guides\/"/);
  assert.match(html, /href="\/site\/topic\/notes\/"/);
  assert.match(html, /<a href="\/site\/topic\/research\/">the research again<\/a>/);
  assert.ok(warnings.some((w) => w.includes('gone.md')));
});

test('without documentBase, links go to the source by a path from the deck', () => {
  const { html } = deck();
  assert.match(html, /href="\.\.\/\.\.\/topic\/research\.md#findings"/);
  assert.match(html, /href="\.\.\/\.\.\/guides\/index\.md"/);
});

test('leaves other links alone', () => {
  const { html } = deck({ documentBase: '/site/' });
  assert.match(html, /href="\.\/gone\.md"/);
  assert.match(html, /href="\.\/data\.csv"/);
  assert.match(html, /href="https:\/\/example\.com\/a\.md"/);
  assert.match(html, /href="#links"/);
  assert.match(html, /\[in code\]\(\.\/research\.md\)/);
});

test('documentBase comes from front matter too', () => {
  const src = write('topic/deck.md', DOC.replace('title: "Linking Deck"', 'title: "Linking Deck"\ndeck_document_base: https://docs.example.com'));
  const html = build(src, { out: path.join(dir, 'out', 'linking'), root: dir, onWarn: () => {} }).deckHtml;
  assert.match(html, /href="https:\/\/docs\.example\.com\/topic\/research\/#findings"/);
});

test('documentRoute honours slug, folder indexes and the workspace boundary', () => {
  assert.equal(documentRoute(write('a/b/page.md', '# P\n'), dir), 'a/b/page');
  assert.equal(documentRoute(write('a/b/index.mdx', '# P\n'), dir), 'a/b');
  assert.equal(documentRoute(write('README.md', '# R\n'), dir), '');
  assert.equal(documentRoute(write('a/rel.md', '---\nslug: renamed\n---\n'), dir), 'a/renamed');
  assert.equal(documentRoute(write('a/abs.md', '---\nslug: /elsewhere/x/\n---\n'), dir), 'elsewhere/x');
  assert.equal(documentRoute(path.join(os.tmpdir(), 'outside.md'), dir), null);
});

test('documentUrl joins without doubling slashes and encodes segments', () => {
  assert.equal(documentUrl('/docs/', 'a/b'), '/docs/a/b/');
  assert.equal(documentUrl('/docs', ''), '/docs/');
  assert.equal(documentUrl('https://x.test/d', 'a b/c'), 'https://x.test/d/a%20b/c/');
});

test('rewriteLinks covers inline links, definitions and anchors, not images', () => {
  const seen = [];
  const out = rewriteLinks(
    '[a](x.md "t") ![i](y.md) [![i](p.png)](z.md?q=1#h)\n[d]: <w.md>\n<a class="k" href=\'v.md\'>v</a>',
    (p, suffix) => { seen.push([p, suffix]); return `N/${p}${suffix}`; },
  );
  assert.equal(out, '[a](N/x.md "t") ![i](y.md) [![i](p.png)](N/z.md?q=1#h)\n[d]: N/w.md\n<a class="k" href=\'N/v.md\'>v</a>');
  assert.deepEqual(seen.map((s) => s[0]), ['x.md', 'z.md', 'w.md', 'v.md']);
});

test('rewriteLinks with markdown: false touches only anchors', () => {
  const out = rewriteLinks('<a href="x.md">x</a> f[i](y.md)', (p) => `N/${p}`, { markdown: false });
  assert.equal(out, '<a href="N/x.md">x</a> f[i](y.md)');
});
