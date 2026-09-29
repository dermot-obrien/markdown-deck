// SPDX-License-Identifier: Apache-2.0
// Background images and named colour schemes: where each setting comes from, what each
// option writes into the deck's stylesheet, and the errors that stop a build.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readSection } from '../src/bindings.mjs';
import {
  build, normaliseBackground, backgroundCss, resolvePalette, checkPalettes,
} from '../src/index.mjs';

let dir;
const write = (rel, text) => {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  return p;
};
const bind = (text) => write('.agents/skill-bindings.toml', `bindingsVersion = "1.0"\n\n${text}`);
const DOC = (fm = '') => `---\ntitle: "Deck"\n${fm}---\n\n# Deck\n\n<!-- deck:cover -->\n\n<!-- deck:slide -->\n## One\n\nText.\n`;
const run = (fm = '', opts = {}) => build(write('docs/doc.md', DOC(fm)), {
  out: path.join(dir, 'out'), onWarn: () => {}, ...opts,
});
// The stylesheet the background adds, which follows the theme and any palette.
const bgCss = (html) => (html.match(/\/\* background(?: image|: none) \*\/[\s\S]*?(?=<\/style>)/) || [''])[0];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-bg-'));
  write('.agents/art/repo.png', 'png');
  write('docs/art/deck.jpg', 'jpg');
  write('elsewhere/cli.webp', 'webp');
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

test('a background is a path, none, or a table with defaults filled in', () => {
  assert.equal(normaliseBackground(undefined), undefined);
  assert.equal(normaliseBackground('none'), null);
  assert.deepEqual(normaliseBackground('a/b.PNG'),
    { image: 'a/b.PNG', slides: 'all', fit: 'cover', position: 'center', wash: 0 });
  assert.deepEqual(
    normaliseBackground({ image: 'x.svg', slides: 'content', fit: 'repeat', position: 'top left', wash: 0.25 }),
    { image: 'x.svg', slides: 'content', fit: 'repeat', position: 'top left', wash: 0.25 },
  );
});

test('a bad background is refused, naming the setting and the choices', () => {
  const bad = (v, re) => assert.throws(() => normaliseBackground(v, 'deck_background'), re);
  bad('x.gif', /deck_background: x.gif is not a supported image type. Use png, jpg, jpeg, svg, webp/);
  bad({ slides: 'all' }, /image is required/);
  bad({ image: 'x.png', slides: 'middle' }, /slides is "middle"; expected one of all, cover, content/);
  bad({ image: 'x.png', fit: 'stretch' }, /fit is "stretch"; expected one of cover, contain, repeat/);
  bad({ image: 'x.png', wash: 1.5 }, /wash is 1.5; expected a number from 0 to 1/);
  bad({ image: 'x.png', wash: 'lots' }, /wash/);
  bad({ image: 'x.png', position: 'center; color: red' }, /not a CSS background-position/);
  bad({ image: 'x.png', opacity: 0.5 }, /unknown key opacity. Known keys: image, slides, fit, position, wash/);
  bad(['x.png'], /expected an image path, none, or a table/);
});

test('each option is written as a background token', () => {
  const css = (v) => backgroundCss(normaliseBackground(v), 'assets/bg.png');
  const all = css('bg.png');
  assert.match(all, /\.slide \{\n {2}--slide-bg-image: url\("assets\/bg.png"\);/);
  assert.match(all, /--slide-bg-size: cover;\n {2}--slide-bg-repeat: no-repeat;\n {2}--slide-bg-position: center;\n {2}--slide-bg-wash: 0;/);
  const cover = css({ image: 'bg.png', slides: 'cover' });
  assert.match(cover, /--slide-bg-image: none;/);
  assert.match(cover, /\.slide\.cover \{ --slide-bg-image: url\("assets\/bg.png"\); \}/);
  assert.match(css({ image: 'bg.png', slides: 'content' }), /\.slide:not\(\.cover\) \{ --slide-bg-image: url/);
  assert.match(css({ image: 'bg.png', fit: 'contain' }), /--slide-bg-size: contain;\n {2}--slide-bg-repeat: no-repeat;/);
  assert.match(css({ image: 'bg.png', fit: 'repeat' }), /--slide-bg-size: auto;\n {2}--slide-bg-repeat: repeat;/);
  assert.match(css({ image: 'bg.png', position: 'right 20% bottom' }), /--slide-bg-position: right 20% bottom;/);
  assert.match(css({ image: 'bg.png', wash: 0.4 }), /--slide-bg-wash: 0.4;/);
  assert.equal(backgroundCss(null), '\n/* background: none */\n.slide { --slide-bg-image: none; }\n');
  assert.equal(backgroundCss(undefined), '');
});

test('the base layout paints every slide from the background tokens', () => {
  const r = run();
  assert.match(r.deckHtml, /var\(--slide-bg-image, none\) var\(--slide-bg-position, center\) \/ var\(--slide-bg-size, cover\) var\(--slide-bg-repeat, no-repeat\)/);
  assert.match(r.deckHtml, /\.slide\.cover \{ --slide-ground: var\(--cover-bg\); \}/);
  assert.equal(bgCss(r.deckHtml), '', 'no background, no background stylesheet');
});

test('a bound background is copied into assets and referenced relatively', () => {
  bind('[suite.markdown-deck]\nbackground = "art/repo.png"\n');
  const r = run();
  assert.ok(fs.existsSync(path.join(r.outDir, 'assets', 'repo.png')));
  assert.match(bgCss(r.deckHtml), /url\("assets\/repo.png"\)/);
  assert.ok(r.manifest.dependencies.images.some((i) => i.path === '.agents/art/repo.png'),
    'the background is a dependency of the deck');
});

test('a bound background table, as a sub-table or inline, takes every option', () => {
  bind('[suite.markdown-deck.background]\nimage = "art/repo.png"\nslides = "cover"\nfit = "contain"\nposition = "top"\nwash = 0.3\n');
  const sub = bgCss(run().deckHtml);
  assert.match(sub, /\.slide\.cover \{ --slide-bg-image: url\("assets\/repo.png"\); \}/);
  assert.match(sub, /--slide-bg-size: contain;/);
  assert.match(sub, /--slide-bg-position: top;/);
  assert.match(sub, /--slide-bg-wash: 0.3;/);
  bind('[suite.markdown-deck]\nbackground = { image = "art/repo.png", slides = "content", fit = "repeat" }\n');
  const inline = bgCss(run().deckHtml);
  assert.match(inline, /\.slide:not\(\.cover\) \{ --slide-bg-image: url/);
  assert.match(inline, /--slide-bg-repeat: repeat;/);
});

test('front matter overrides the binding, and the option overrides both', () => {
  bind('[suite.markdown-deck]\nbackground = "art/repo.png"\n');
  const fm = run('deck_background: art/deck.jpg\n');
  assert.match(bgCss(fm.deckHtml), /assets\/deck.jpg/, 'deck_background resolves against the document');
  assert.doesNotMatch(bgCss(fm.deckHtml), /repo.png/);

  const yaml = run('deck_background:\n  image: art/deck.jpg\n  slides: content\n  wash: 0.5\n');
  assert.match(bgCss(yaml.deckHtml), /\.slide:not\(\.cover\) \{ --slide-bg-image: url\("assets\/deck.jpg"\); \}/);
  assert.match(bgCss(yaml.deckHtml), /--slide-bg-wash: 0.5;/);

  const cwd = process.cwd();
  process.chdir(path.join(dir, 'elsewhere'));
  try {
    const opt = run('deck_background: art/deck.jpg\n', { background: 'cli.webp' });
    assert.match(bgCss(opt.deckHtml), /assets\/cli.webp/, 'the option resolves against the working directory');
  } finally {
    process.chdir(cwd);
  }
});

test('none turns a bound background off for one deck', () => {
  bind('[suite.markdown-deck]\nbackground = "art/repo.png"\n');
  for (const r of [run('deck_background: none\n'), run('', { background: 'none' })]) {
    assert.equal(bgCss(r.deckHtml).trim(), '/* background: none */\n.slide { --slide-bg-image: none; }');
  }
  const r = run('deck_background: none\n', { out: path.join(dir, 'none') });
  assert.equal(fs.existsSync(path.join(r.outDir, 'assets', 'repo.png')), false, 'nothing is copied');
});

test('a background declared but missing, or of an unknown type, fails the build', () => {
  bind('[suite.markdown-deck]\nbackground = "art/gone.png"\n');
  assert.throws(() => run(), /\[suite\.markdown-deck\] background in .*skill-bindings\.toml: background image art\/gone\.png not found/);
  assert.throws(() => run('deck_background: art/gone.svg\n'), /deck_background in .*doc\.md: background image art\/gone\.svg not found/);
  assert.throws(() => run('', { background: 'x.bmp' }), /--background: x\.bmp is not a supported image type/);
  assert.throws(() => run('deck_background:\n  image: art/deck.jpg\n  fit: fill\n'), /deck_background in .*: fit is "fill"/);
});

test('a cover-only background on a deck with no cover is warned about', () => {
  const warnings = [];
  build(write('docs/bare.md', '# Bare\n\n<!-- deck:slide -->\n## One\n\nText.\n'), {
    out: path.join(dir, 'bare'), background: { image: path.join(dir, 'docs/art/deck.jpg'), slides: 'cover' },
    onWarn: (m) => warnings.push(m),
  });
  assert.ok(warnings.some((w) => /no deck:cover/.test(w)), warnings.join('\n'));
});

test('an html slide keeps its own content: the background sits behind the frame', () => {
  write('docs/designed.html', '<!doctype html><html><body><h2>Made</h2></body></html>');
  write('docs/html.md', '# H\n\n<!-- deck:html src="./designed.html" title="Designed" header="true" -->\n');
  const r = build(path.join(dir, 'docs/html.md'), {
    out: path.join(dir, 'html'), background: path.join(dir, 'docs/art/deck.jpg'), onWarn: () => {},
  });
  assert.match(r.deckHtml, /<section class="slide html-slide with-header"[^>]*>\s*<header class="slide-header">/);
  const frame = r.deckHtml.match(/srcdoc="([^"]*)"/)[1];
  assert.doesNotMatch(frame, /deck\.jpg|slide-bg-image/, 'nothing is injected into the frame');
});

test('palettes are named schemes, picked by the binding, front matter or option', () => {
  bind(`[suite.markdown-deck]
palette = "dusk"

[suite.markdown-deck.palettes.dusk]
heading = "#3b2f5c"

[suite.markdown-deck.palettes.meadow]
heading = "#2e6b3a"
`);
  assert.match(run().deckHtml, /--heading: #3b2f5c/);
  const fm = run('deck_palette: meadow\n');
  assert.match(fm.deckHtml, /--heading: #2e6b3a/);
  assert.doesNotMatch(fm.deckHtml, /#3b2f5c/);
  assert.match(run('deck_palette: meadow\n', { palette: 'dusk' }).deckHtml, /--heading: #3b2f5c/);
  const table = run('deck_palette:\n  heading: "#123456"\n');
  assert.match(table.deckHtml, /--heading: #123456/, 'a table of tokens still works in front matter');
  const none = run('deck_palette: none\n');
  assert.doesNotMatch(none.deckHtml, /palette override/, "none keeps the theme's own colours");
  assert.doesNotMatch(run('', { palette: 'none' }).deckHtml, /palette override/);
});

test('an unknown scheme name fails the build, naming the known ones', () => {
  bind('[suite.markdown-deck.palettes.dusk]\nheading = "#3b2f5c"\n\n[suite.markdown-deck.palettes.meadow]\nheading = "#2e6b3a"\n');
  assert.throws(() => run('deck_palette: dawn\n'), /deck_palette in .*doc\.md: no palette named "dawn"\. Known: dusk, meadow, or none/);
  assert.throws(() => run('', { palette: 'dawn' }), /--palette: no palette named "dawn"/);
  bind('[suite.markdown-deck]\ntheme = "default"\n');
  assert.throws(() => run('deck_palette: dusk\n'), /no palette named "dusk"\. Name schemes in \[suite\.markdown-deck\.palettes\]/);
});

test('an unknown token in any named scheme fails the build', () => {
  bind('[suite.markdown-deck.palettes.dusk]\nheadng = "#3b2f5c"\n');
  assert.throws(() => run(), /palettes in .*skill-bindings\.toml\.dusk: unknown palette token: headng/);
  assert.throws(() => checkPalettes({ dusk: 'red' }), /dusk must be a table of palette tokens/);
  assert.throws(() => checkPalettes('dusk'), /must be a table of named palettes/);
});

test('resolvePalette: a table is itself, a name is its scheme, none is null', () => {
  const schemes = { dusk: { heading: '#3b2f5c' } };
  assert.equal(resolvePalette(undefined, schemes), undefined);
  assert.equal(resolvePalette('none', schemes), null);
  assert.deepEqual(resolvePalette('dusk', schemes), { heading: '#3b2f5c' });
  assert.deepEqual(resolvePalette({ accent: '#fff' }, schemes), { accent: '#fff' });
});

test('the binding reader takes named schemes and inline tables', () => {
  assert.deepEqual(readSection(`[suite.markdown-deck]
background = { image = "a, b.png", wash = 0.2 }  # trailing
[suite.markdown-deck.palettes.dusk]
heading = "#3b2f5c"
[suite.markdown-deck.too.deep.here]
x = 1
`), { background: { image: 'a, b.png', wash: 0.2 }, palettes: { dusk: { heading: '#3b2f5c' } } });
  assert.throws(() => readSection('[suite.markdown-deck]\nbackground = { image = "a.png"'), /unterminated inline table/);
});
