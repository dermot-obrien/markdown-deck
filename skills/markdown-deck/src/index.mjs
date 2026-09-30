// SPDX-License-Identifier: Apache-2.0
/**
 * markdown-deck library entry point.
 *
 * build() takes one tagged Markdown file and writes a self-contained deck. It has no
 * knowledge of any host repository: every path it touches is derived from its arguments.
 * That is what makes this skill publishable on its own.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { createRequire } from 'node:module';
import {
  collectSlides, collectCover, slideBody, rewriteImages, linkDefinitions, findSection, slug,
  rewriteResources, rewriteLinks, remoteResources, paginateTables,
} from './parse.mjs';
import { makeMarked, renderSlideBody, renderDeck, renderPartial } from './render.mjs';
import { repoDefaults, workspaceRoot } from './bindings.mjs';
import { checkRender, staleMessage, refreshRender } from './freshness.mjs';

const { findPublishedDecks } = createRequire(import.meta.url)('./catalog.cjs');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const THEMES = path.resolve(HERE, '..', 'themes');
export const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
const MERMAID_FILE = path.join('node_modules', 'mermaid', 'dist', 'mermaid.min.js');
const DOCUMENT_EXT = /\.mdx?$/i;

/**
 * Where a document of the workspace is published, relative to the site's root: its path
 * from the workspace root with the extension dropped, and a folder's index.md or
 * README.md standing for the folder. A `slug` in the document's front matter replaces
 * that: one starting with / is the whole route, any other replaces the file name within
 * its folder. Null for a document outside the workspace.
 */
export function documentRoute(file, root) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  if (!rel || rel.startsWith('../') || path.isAbsolute(rel)) return null;
  const dir = path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel);
  const trim = (r) => r.split('/').filter(Boolean).join('/');
  let fm = {};
  try { fm = matter(fs.readFileSync(file, 'utf8')).data || {}; } catch { /* no usable front matter */ }
  const slugged = typeof fm.slug === 'string' ? fm.slug.trim() : '';
  if (slugged) return trim(slugged.startsWith('/') ? slugged : `${dir}/${slugged}`);
  const name = path.posix.basename(rel).replace(DOCUMENT_EXT, '');
  return trim(/^(index|readme)$/i.test(name) ? dir : `${dir}/${name}`);
}

/** A route under documentBase, as a folder URL: `/docs/` and `a/b` give `/docs/a/b/`. */
export function documentUrl(base, route) {
  const encoded = route.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `${base.replace(/\/+$/, '')}/${encoded ? `${encoded}/` : ''}`;
}

/**
 * A mermaid installed where the document or this skill can see it: the nearest
 * node_modules above the document, then the skill's own. Null when there is none.
 */
export function findLocalMermaid(fromDir) {
  for (let dir = path.resolve(fromDir); ; dir = path.dirname(dir)) {
    const f = path.join(dir, MERMAID_FILE);
    if (fs.existsSync(f)) return f;
    if (path.dirname(dir) === dir) break;
  }
  const own = path.resolve(HERE, '..', MERMAID_FILE);
  return fs.existsSync(own) ? own : null;
}

export function listThemes() {
  return fs.readdirSync(THEMES)
    .filter((f) => f.endsWith('.css') && !f.startsWith('_'))
    .map((f) => f.replace(/\.css$/, ''));
}

/** Rows a table may carry on one slide before it continues on the next. */
export const DEFAULT_TABLE_ROWS = 12;

/** The tokens a palette may set. Anything else is rejected rather than silently ignored. */
export const PALETTE_TOKENS = Object.freeze([
  'font-body', 'font-mono',
  'deck-bg', 'slide-bg', 'slide-fg', 'body', 'heading', 'on-heading', 'rule', 'row-alt',
  'accent', 'accent-deep', 'accent-wash',
  'code-bg', 'code-fg', 'code-inline-bg',
  'cover-bg', 'cover-fg', 'cover-accent', 'cover-muted', 'cover-faint',
  'divider-bg', 'divider-fg', 'divider-accent', 'divider-muted',
  'chrome-fg',
]);

/**
 * Turn a palette into a `:root` block that overrides the theme's tokens.
 *
 * A palette is how an organisation gets its own colours without shipping a CSS file
 * into this skill: it sets the tokens in its own `.agents/skill-bindings.toml`, and the
 * skill stays brand-free. Keys are token names without the `--` prefix, so a binding
 * reads `heading = "#143a5a"` rather than carrying CSS syntax.
 *
 * An unknown key throws. A palette is small and hand-written, and a typo that silently
 * does nothing is worse than a build that stops and names it.
 */
export function paletteCss(palette) {
  if (!palette || typeof palette !== 'object') return '';
  const entries = Object.entries(palette)
    .filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  for (const [k] of entries) {
    if (!PALETTE_TOKENS.includes(k)) {
      throw new Error(`unknown palette token: ${k}. Known tokens: ${PALETTE_TOKENS.join(', ')}`);
    }
  }
  const decls = entries.map(([k, v]) => `  --${k}: ${v};`).join('\n');
  return `\n/* palette override */\n:root {\n${decls}\n}\n`;
}

/**
 * Theme CSS is the theme's tokens, then the layout base, then any palette override.
 *
 * A theme may be a built-in name or a path to a .css file. The palette comes last so it
 * wins over whichever theme was chosen, which is what lets an organisation keep a
 * built-in theme's layout and change only its colours.
 */
export function loadTheme(name, palette) {
  const base = fs.readFileSync(path.join(THEMES, '_base.css'), 'utf8');
  const builtin = path.join(THEMES, `${name}.css`);
  const file = fs.existsSync(builtin) ? builtin : path.resolve(name);
  if (!fs.existsSync(file)) {
    throw new Error(`no such theme: ${name}. Available: ${listThemes().join(', ')}`);
  }
  return `${fs.readFileSync(file, 'utf8')}\n${base}${paletteCss(palette)}`;
}

/**
 * Check every named colour scheme in `palettes`, so a typo in one fails the build that
 * reads it rather than waiting for the deck that picks it.
 */
export function checkPalettes(palettes, where = 'palettes') {
  if (palettes === undefined || palettes === null) return {};
  if (typeof palettes !== 'object' || Array.isArray(palettes)) {
    throw new Error(`${where} must be a table of named palettes, each a table of tokens`);
  }
  for (const [name, tokens] of Object.entries(palettes)) {
    if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
      throw new Error(`${where}.${name} must be a table of palette tokens`);
    }
    for (const k of Object.keys(tokens)) {
      if (!PALETTE_TOKENS.includes(k)) {
        throw new Error(`${where}.${name}: unknown palette token: ${k}. Known tokens: ${PALETTE_TOKENS.join(', ')}`);
      }
    }
  }
  return palettes;
}

/**
 * The tokens a palette setting stands for. A table of tokens is itself; a string names a
 * scheme in `palettes`; `none` means the theme's own colours. Unset is undefined.
 * An unknown name throws, naming the schemes there are.
 */
export function resolvePalette(value, palettes = {}, where = 'palette') {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  const name = String(value).trim();
  if (name === 'none') return null;
  if (palettes && Object.prototype.hasOwnProperty.call(palettes, name)) return palettes[name];
  const known = Object.keys(palettes || {});
  throw new Error(`${where}: no palette named "${name}". `
    + (known.length ? `Known: ${known.join(', ')}, or none` : 'Name schemes in [suite.markdown-deck.palettes] first, or give a table of tokens'));
}

/** Image types a background may be, by extension. */
export const BACKGROUND_TYPES = Object.freeze(['png', 'jpg', 'jpeg', 'svg', 'webp']);
const BACKGROUND_KEYS = Object.freeze(['image', 'slides', 'fit', 'position', 'wash']);
const BACKGROUND_SLIDES = Object.freeze(['all', 'cover', 'content']);
const BACKGROUND_FITS = Object.freeze({
  cover: { size: 'cover', repeat: 'no-repeat' },
  contain: { size: 'contain', repeat: 'no-repeat' },
  repeat: { size: 'auto', repeat: 'repeat' },
});

/**
 * A background setting in its full form, or null for `none`, or undefined when unset.
 *
 * A string is the image's path, or `none`. A table gives `image` (required), `slides`
 * (all, cover or content, which is every slide but the cover), `fit` (cover, contain or
 * repeat), `position` (a CSS background-position) and `wash` (0 to 1, how much of the
 * slide's own ground colour lies over the image, to keep text legible). Anything else
 * throws, naming the setting.
 */
export function normaliseBackground(value, where = 'background') {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') {
    if (value.trim() === 'none') return null;
    value = { image: value };
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${where}: expected an image path, none, or a table with ${BACKGROUND_KEYS.join(', ')}`);
  }
  for (const k of Object.keys(value)) {
    if (!BACKGROUND_KEYS.includes(k)) {
      throw new Error(`${where}: unknown key ${k}. Known keys: ${BACKGROUND_KEYS.join(', ')}`);
    }
  }
  const image = typeof value.image === 'string' ? value.image.trim() : '';
  if (!image) throw new Error(`${where}: image is required, a path to a ${BACKGROUND_TYPES.join(', ')} file`);
  const ext = path.extname(image).slice(1).toLowerCase();
  if (!BACKGROUND_TYPES.includes(ext)) {
    throw new Error(`${where}: ${image} is not a supported image type. Use ${BACKGROUND_TYPES.join(', ')}`);
  }
  const slides = String(value.slides ?? 'all');
  if (!BACKGROUND_SLIDES.includes(slides)) {
    throw new Error(`${where}: slides is "${slides}"; expected one of ${BACKGROUND_SLIDES.join(', ')}`);
  }
  const fit = String(value.fit ?? 'cover');
  if (!BACKGROUND_FITS[fit]) {
    throw new Error(`${where}: fit is "${fit}"; expected one of ${Object.keys(BACKGROUND_FITS).join(', ')}`);
  }
  const position = String(value.position ?? 'center').trim();
  // It is written into the deck's stylesheet, so nothing that could end a declaration.
  if (!position || /[;{}<>"'\\]/.test(position)) {
    throw new Error(`${where}: position "${position}" is not a CSS background-position`);
  }
  const wash = Number(value.wash ?? 0);
  if (!Number.isFinite(wash) || wash < 0 || wash > 1 || (typeof value.wash === 'string' && !value.wash.trim())) {
    throw new Error(`${where}: wash is ${JSON.stringify(value.wash)}; expected a number from 0 to 1`);
  }
  return { image, slides, fit, position, wash };
}

/**
 * The stylesheet a background adds: the theme's background tokens, set for the slides
 * it covers. `_base.css` paints every slide from these tokens, so a theme can set them
 * itself and a palette composes with them. `href` is the copied image, relative to the
 * deck; null switches any background image off.
 */
export function backgroundCss(bg, href) {
  if (bg === null) return '\n/* background: none */\n.slide { --slide-bg-image: none; }\n';
  if (!bg) return '';
  const { size, repeat } = BACKGROUND_FITS[bg.fit];
  const image = `url("${href}")`;
  const target = { all: '.slide', cover: '.slide.cover', content: '.slide:not(.cover)' }[bg.slides];
  return `
/* background image */
.slide {
  --slide-bg-image: ${bg.slides === 'all' ? image : 'none'};
  --slide-bg-size: ${size};
  --slide-bg-repeat: ${repeat};
  --slide-bg-position: ${bg.position};
  --slide-bg-wash: ${bg.wash};
}
${bg.slides === 'all' ? '' : `${target} { --slide-bg-image: ${image}; }\n`}`;
}

/**
 * Resolves `deck:include` tags for one document.
 *
 *   src="../other.md"   a document by path, relative to the including one
 *   deck="<deck_id>"    a published deck by its permanent id, found through the catalog,
 *                       so the include survives the source document being moved
 *   section="Heading"   a section by heading text; the source need not be a deck
 *   slide="<slide-id>"  a slide the source already tags, by its id
 *
 * Anything that cannot be found throws, naming what was asked for and what exists: a
 * silently missing slide in a deck is worse than a failed build.
 */
function includer(srcPath, rootOpt) {
  let catalogCache = null;
  const root = rootOpt || workspaceRoot(path.dirname(srcPath));
  const byDeckId = (id) => {
    if (!catalogCache) catalogCache = findPublishedDecks(root).decks;
    const d = catalogCache.find((x) => x.id === id);
    if (!d) {
      throw new Error(`deck:include deck="${id}": no published deck has that id under ${root}. `
        + `Known: ${catalogCache.map((x) => x.id).join(', ') || '(none)'}`);
    }
    return path.join(root, d.source);
  };
  return (s) => {
    const file = s.deck ? byDeckId(s.deck) : path.resolve(path.dirname(srcPath), s.src);
    const where = s.deck ? `deck "${s.deck}"` : s.src;
    if (!fs.existsSync(file)) throw new Error(`deck:include src="${s.src}": no such file (${file})`);
    if (path.resolve(file) === path.resolve(srcPath)) throw new Error(`deck:include of ${where} includes itself`);
    const { data, content } = matter(fs.readFileSync(file, 'utf8'));
    let found;
    if (s.slide) {
      const tagged = collectSlides(content).filter((x) => x.kind === 'content');
      found = tagged.find((x) => slug(x.label) === s.slide);
      if (!found) {
        throw new Error(`deck:include of ${where}: no slide "${s.slide}". `
          + `Slides: ${tagged.map((x) => slug(x.label)).join(', ') || '(none tagged)'}`);
      }
    } else {
      found = findSection(content, s.section);
      if (!found) throw new Error(`deck:include of ${where}: no section headed "${s.section}"`);
    }
    return {
      file, where, title: found.title, body: found.body, defs: linkDefinitions(content),
      // The source's own eyebrow names it best, when it sets one.
      sourceTitle: String(data.deck_eyebrow || data.sidebar_label || data.title
        || path.basename(file, path.extname(file))),
    };
  };
}

/**
 * Width and height of a PNG from its header, or null for anything else. Enough to check
 * that an image slide is 16:9 and high-definition without an image library.
 */
export function pngSize(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(24);
    fs.readSync(fd, b, 0, 24, 0);
    fs.closeSync(fd);
    if (b.readUInt32BE(0) !== 0x89504e47 || b.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  } catch {
    return null;
  }
}

/** Media above this size is warned about: it makes the deck slow to open and to publish. */
export const MEDIA_WARN_BYTES = 50 * 1024 * 1024;
const MEDIA_EXT = /\.(mp4|m4v|mov|webm|ogv|ogg|mp3|m4a|wav|aac|flac)$/i;

/** An image slide fills the 16:9 canvas; say so when the image will not. */
function checkImage(file, label, onWarn) {
  const size = pngSize(file);
  if (!size) return;
  const ratio = size.width / size.height;
  if (Math.abs(ratio - 16 / 9) > 0.02) {
    onWarn(`image slide "${label}" is ${size.width}x${size.height}, not 16:9; it will be letterboxed`);
  } else if (size.width < 1920) {
    onWarn(`image slide "${label}" is ${size.width}x${size.height}; below 1920x1080 it will look soft when presented`);
  }
}

/**
 * @param {string} input     path to the tagged Markdown file
 * @param {object} opts      { out, theme, palette, background, title, subtitle, date,
 *                             footnote, eyebrow, logo, mermaidSrc, partials, thumbnails, slideNumbers,
 *                             comments, tableRows, feedbackTo, feedbackSubject, deckId,
 *                             htmlName, bindings, strictRenders, refresh, root, onWarn, onLog }
 *
 * `palette` is a table of tokens, a scheme named in the `palettes` binding, or none.
 * `background` is an image path, none, or a table (see normaliseBackground); a path
 * resolves against the file that gives it: the working directory for an option, the
 * document for deck_background, the binding file for the binding.
 *
 * `refresh` re-renders a stale image through the model skill before using it, so a
 * build picks up a diagram edited since its last render.
 *
 * An image with a render record (see freshness.mjs) whose source has changed since it was
 * rendered is reported. `strictRenders` makes that fail the build; it defaults to on when
 * the CI environment variable is set, so a stale picture warns locally and fails in CI.
 *
 * Each setting resolves option, then the document's front matter, then the repository's
 * [suite.markdown-deck] binding, then the built-in default. Pass `bindings: false` to
 * ignore the repository.
 * @returns {{deckHtml: string, slides: object[], outDir: string, manifest: object, pdf: boolean}}
 *   pdf is whether a PDF is wanted (option, deck_pdf, the pdf binding, else false). build()
 *   does not export it, since export is asynchronous; the caller does, as the CLI does.
 */
export function build(input, opts = {}) {
  const onWarn = opts.onWarn || ((m) => console.error(`  ! ${m}`));
  const srcPath = path.resolve(input);
  if (!fs.existsSync(srcPath)) throw new Error(`input not found: ${srcPath}`);
  const srcDir = path.dirname(srcPath);

  const { data, content } = matter(fs.readFileSync(srcPath, 'utf8'));
  const cover = collectCover(content);
  const found = collectSlides(content, { onWarn });
  if (!cover && found.length === 0) {
    throw new Error(`${input} carries no deck: tags. Add <!-- deck:cover -->, <!-- deck:slide -->, <!-- deck:image --> or <!-- deck:html -->.`);
  }

  const outDir = path.resolve(opts.out || path.join(srcDir, 'dist'));
  const assetsDir = path.join(outDir, 'assets');
  fs.mkdirSync(outDir, { recursive: true });

  const bound = opts.bindings === false ? { file: null, values: {} } : repoDefaults(srcDir);
  const repo = bound.values;
  const pick = (opt, fm, key, fallback) => opt ?? data[fm] ?? repo[key] ?? fallback;
  // A theme named in the binding may be a path to a .css file the repository keeps for
  // itself, which is how an organisation holds its own theme without one in this skill.
  // Resolve it against the binding file, as every other path in that file resolves, so it
  // does not depend on where the build was run from.
  const themeFrom = (v) => (
    v === repo.theme && bound.file && typeof v === 'string' && v.endsWith('.css')
      ? path.resolve(path.dirname(bound.file), v)
      : v
  );
  const title = opts.title || data.title || data.sidebar_label || path.basename(srcPath, '.md');
  // The small line above every slide title. deck_eyebrow sets it for the deck, "" turns
  // it off; a slide's own eyebrow attribute overrides it for that slide.
  const eyebrow = String(opts.eyebrow ?? data.deck_eyebrow ?? data.sidebar_label ?? '');
  const deckId = slug(opts.deckId || data.deck_id || title);
  const htmlName = opts.htmlName || 'deck.html';
  // Where a setting came from, so a path in it resolves against the file that wrote it
  // and an error names that file.
  const origin = (opt, fm, key) => (
    opt !== undefined && opt !== null ? { dir: process.cwd(), where: `--${key}` }
      : data[fm] !== undefined && data[fm] !== null ? { dir: srcDir, where: `${fm} in ${input}` }
        : repo[key] !== undefined ? { dir: path.dirname(bound.file), where: `[suite.markdown-deck] ${key} in ${bound.file}` }
          : null
  );
  // A palette is a table of tokens, or the name of one of the schemes in `palettes`, or
  // none for the theme's own colours.
  const palettes = checkPalettes(repo.palettes, bound.file ? `[suite.markdown-deck] palettes in ${bound.file}` : 'palettes');
  const paletteFrom = origin(opts.palette, 'deck_palette', 'palette');
  const palette = resolvePalette(
    pick(opts.palette, 'deck_palette', 'palette', undefined), palettes, paletteFrom?.where,
  );
  let css = loadTheme(themeFrom(pick(opts.theme, 'deck_theme', 'theme', 'default')), palette);
  const mdInst = makeMarked();

  // Images resolve against the document they are written in, which for an included slide
  // is the source document, not this one.
  // Everything the deck was built from, for the manifest; and any image rendered from a
  // diagram that has changed since.
  const root = opts.root || workspaceRoot(srcDir);
  const fromRoot = (f) => path.relative(root, f).split(path.sep).join('/');
  const documents = new Set([srcPath]);
  const images = new Map();
  const stale = [];
  const copyAsset = (href, baseDir = srcDir, what = 'image') => {
    const from = path.resolve(baseDir, href);
    if (!fs.existsSync(from) || !fs.statSync(from).isFile()) {
      onWarn(`${what} not found, left as-is: ${href}`);
      return null;
    }
    if (MEDIA_EXT.test(from) && !images.has(from) && fs.statSync(from).size > (opts.mediaWarnBytes ?? MEDIA_WARN_BYTES)) {
      onWarn(`${path.basename(from)} is ${Math.round(fs.statSync(from).size / 1048576)} MB; `
        + 'a deck this heavy is slow to open and to publish');
    }
    if (!images.has(from)) {
      let check = checkRender(from);
      // --refresh re-renders a stale image before it is copied, rather than reporting it.
      if (check && !check.fresh && opts.refresh) {
        (opts.onLog || console.log)(`  re-rendering ${path.relative(root, from).split(path.sep).join('/')}`);
        check = refreshRender(from, check);
      }
      images.set(from, check);
      if (check && !check.fresh) stale.push(staleMessage(from, check));
    }
    fs.mkdirSync(assetsDir, { recursive: true });
    const base = path.basename(from);
    fs.copyFileSync(from, path.join(assetsDir, base));
    return `assets/${encodeURIComponent(base)}`;
  };

  // A background image behind the slides, copied into assets/ so the deck and its PDF
  // stay self-contained. Declared but missing fails the build: a deck that silently lost
  // its background looks finished and is not.
  const backgroundFrom = origin(opts.background, 'deck_background', 'background');
  const background = normaliseBackground(
    pick(opts.background, 'deck_background', 'background', undefined), backgroundFrom?.where,
  );
  if (background) {
    const file = path.resolve(backgroundFrom.dir, background.image);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new Error(`${backgroundFrom.where}: background image ${background.image} not found (${file})`);
    }
    if (background.slides === 'cover' && !cover) {
      onWarn('the background is for the cover only, and this deck has no deck:cover');
    }
    css += backgroundCss(background, copyAsset(file, srcDir, 'background image'));
  } else if (background === null) {
    css += backgroundCss(null);
  }

  // A link to another document of the workspace would point at its Markdown source, which
  // is not beside the deck. With documentBase, where the workspace's documents are
  // published, it goes to the document's page there; without, to the source file by a
  // path from the deck, which holds while the deck is opened from disk.
  const documentBase = String(pick(opts.documentBase, 'deck_document_base', 'documentBase', '') || '');
  const linkDocument = (baseDir) => (href, suffix) => {
    if (!DOCUMENT_EXT.test(href)) return null;
    const file = path.resolve(baseDir, href);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      onWarn(`linked document not found, left as-is: ${href}`);
      return null;
    }
    if (documentBase) {
      const route = documentRoute(file, root);
      if (route !== null) return documentUrl(documentBase, route) + suffix;
      onWarn(`${href} is outside the workspace, so it has no page under documentBase; linked by path`);
    }
    return path.relative(outDir, file).split(path.sep).map(encodeURIComponent).join('/') + suffix;
  };

  // Reference links resolve against definitions anywhere in the document, usually its
  // foot, so every slide carries the full set.
  const defs = rewriteLinks(linkDefinitions(content), linkDocument(srcDir));
  const used = new Set();
  const uniqueId = (label) => {
    let file = slug(label);
    let n = 2;
    while (used.has(file)) file = `${slug(label)}-${n++}`;
    used.add(file);
    return file;
  };
  const slides = [];
  // A table longer than this many rows continues on the next slide, header repeated,
  // rather than shrinking every row to fit. A slide's table-rows attribute overrides it,
  // and 0 turns splitting off.
  const tableRows = Number(pick(opts.tableRows, 'deck_table_rows', 'tableRows', DEFAULT_TABLE_ROWS));
  // One content slide, or several when a long table is split across pages. The first
  // page keeps the slide's id, so links to it still land; the rest are numbered on.
  const pushContent = ({ label, title, limit, body, notes, finish, ...rest }) => {
    const pages = paginateTables(body, limit ?? tableRows);
    pages.forEach((page, k) => {
      const of = pages.length > 1 ? ` (${k + 1} of ${pages.length})` : '';
      slides.push({
        kind: 'content',
        file: uniqueId(k ? `${label} ${k + 1}` : label),
        label: `${label}${of}`,
        title: `${title}${of}`,
        ...rest,
        notes: k ? [] : notes,
        bodyHtml: renderSlideBody(finish(page), mdInst),
      });
    });
  };
  const resolveInclude = includer(srcPath, root);
  for (const s of found) {
    if (s.kind === 'divider') {
      slides.push({
        kind: 'divider', file: uniqueId(s.label), label: s.label, title: s.title,
        subtitle: s.subtitle, ...(s.eyebrow !== undefined ? { eyebrow: s.eyebrow } : {}), notes: [],
      });
      continue;
    }
    if (s.kind === 'include') {
      // A section of another document, rendered here in this deck's theme. The eyebrow
      // names where it came from; links and images resolve from the source.
      const inc = resolveInclude(s);
      documents.add(path.resolve(inc.file));
      const { body: stripped, notes } = slideBody(inc.body);
      if (!stripped) throw new Error(`deck:include of ${inc.where} is empty after deck:skip removal`);
      const incDir = path.dirname(inc.file);
      // A section that is nothing but an image is a picture of a slide, so it fills the
      // canvas, like deck:image, rather than sitting shrunk under this deck's header.
      // header="true" keeps the header layout instead.
      const only = stripped.match(/^!\[[^\]]*\]\(([^)\s]+)[^)]*\)$/);
      if (only && !s.header) {
        const src = copyAsset(decodeURIComponent(only[1]), incDir);
        if (!src) throw new Error(`deck:include of ${inc.where}: image ${only[1]} not found`);
        checkImage(path.resolve(incDir, decodeURIComponent(only[1])), s.title || inc.title, onWarn);
        const label = s.label || s.title || inc.title;
        slides.push({
          kind: 'image', file: uniqueId(label), label, title: s.title || inc.title, src,
          header: false, source: inc.where, caption: s.eyebrow ?? `From ${inc.sourceTitle}`, notes: [],
        });
        continue;
      }
      const incDefs = rewriteLinks(inc.defs, linkDocument(incDir));
      pushContent({
        label: s.label || inc.title,
        title: s.title || inc.title,
        eyebrow: s.eyebrow ?? `From ${inc.sourceTitle}`,
        source: inc.where,
        notes,
        body: rewriteLinks(rewriteImages(stripped, (href) => copyAsset(href, incDir)), linkDocument(incDir)),
        finish: (page) => `${page}\n\n${incDefs}`,
      });
      continue;
    }
    if (s.kind === 'html') {
      // A whole slide from a self-contained HTML file, for a layout Markdown cannot
      // express. The files it loads are copied like images, and the renderer isolates it
      // in a frame so its styles and scripts cannot reach the deck.
      const file = path.resolve(srcDir, decodeURIComponent(s.src));
      if (!fs.existsSync(file)) {
        onWarn(`html slide "${s.label}" skipped: ${s.src} not found`);
        continue;
      }
      documents.add(file);
      const raw = fs.readFileSync(file, 'utf8');
      const remote = remoteResources(raw);
      if (remote.length) {
        onWarn(`html slide "${s.label}" loads ${remote.length} resource(s) from the network, so it is `
          + `incomplete offline: ${remote.slice(0, 3).join(', ')}${remote.length > 3 ? ', ...' : ''}`);
      }
      const html = rewriteLinks(
        rewriteResources(raw, (h) => copyAsset(h, path.dirname(file), 'file'), { css: true }),
        linkDocument(path.dirname(file)), { markdown: false },
      );
      slides.push({
        kind: 'html', file: uniqueId(s.label), label: s.label, title: s.title, html,
        header: s.header, ...(s.eyebrow !== undefined ? { eyebrow: s.eyebrow } : {}), notes: [],
      });
      continue;
    }
    if (s.kind === 'image') {
      const src = copyAsset(decodeURIComponent(s.src));
      if (!src) {
        onWarn(`image slide "${s.label}" skipped: ${s.src} not found`);
        continue;
      }
      checkImage(path.resolve(srcDir, decodeURIComponent(s.src)), s.label, onWarn);
      slides.push({ kind: 'image', file: uniqueId(s.label), label: s.label, title: s.title, src, header: s.header, notes: [] });
      continue;
    }
    const { body: stripped, notes } = slideBody(s.body);
    if (!stripped) {
      onWarn(`slide "${s.label}" is empty after deck:skip removal; skipped`);
      continue;
    }
    pushContent({
      label: s.label,
      title: s.title,
      limit: s.tableRows,
      ...(s.eyebrow !== undefined ? { eyebrow: s.eyebrow } : {}),
      notes,
      body: rewriteLinks(
        rewriteImages(rewriteResources(stripped, (h) => copyAsset(h, srcDir, 'file')), copyAsset),
        linkDocument(srcDir),
      ),
      finish: (page) => `${page}\n\n${defs}`,
    });
  }

  const strict = opts.strictRenders ?? Boolean(process.env.CI);

  // Mermaid, when a slide has a diagram. A deck is meant to open from disk, so a local
  // copy is preferred and copied beside the deck: the `mermaid` option or binding, a path
  // or a URL, else an installed mermaid, else the CDN.
  const needsMermaid = slides.some((s) => (s.bodyHtml || '').includes('class="mermaid"'));
  const mermaidFor = () => {
    const named = opts.mermaidSrc ?? repo.mermaid;
    if (named && /^(https?:)?\/\//i.test(named)) return named;
    const file = named
      ? path.resolve(named === repo.mermaid && bound.file ? path.dirname(bound.file) : process.cwd(), named)
      : findLocalMermaid(srcDir);
    if (!file || !fs.existsSync(file)) {
      if (named) onWarn(`mermaid not found at ${named}; loading it from ${MERMAID_CDN}`);
      return MERMAID_CDN;
    }
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.copyFileSync(file, path.join(assetsDir, 'mermaid.min.js'));
    return 'assets/mermaid.min.js';
  };
  if (stale.length && strict) throw new Error(stale.join('\n'));
  for (const m of stale) onWarn(m);

  const deckHtml = renderDeck({
    title,
    eyebrow,
    css,
    cover: cover
      ? {
          subtitle: opts.subtitle ?? cover.subtitle ?? data.description ?? '',
          date: opts.date ?? cover.date ?? '',
          footnote: opts.footnote ?? cover.footnote ?? '',
          logo: opts.logo ?? cover.logo ?? '',
        }
      : null,
    slides,
    mermaidSrc: needsMermaid ? mermaidFor() : '',
    // The slide index lists titles unless asked for thumbnails, by option or front matter.
    thumbnails: Boolean(pick(opts.thumbnails, 'deck_thumbnails', 'thumbnails', false)),
    // A page number on every slide but the first, unless turned off.
    slideNumbers: String(pick(opts.slideNumbers, 'deck_slide_numbers', 'slideNumbers', true)) !== 'false',
    // Per-slide review comments, off unless asked for. The id keys the reviewer's stored
    // comments, so it must not change when the file is renamed or the title reworded.
    comments: Boolean(pick(opts.comments, 'deck_comments', 'comments', false)),
    id: deckId,
    version: data.version ? String(data.version) : '',
    feedback: {
      to: String(pick(opts.feedbackTo, 'deck_feedback_to', 'feedbackTo', '')),
      subject: String(pick(opts.feedbackSubject, 'deck_feedback_subject', 'feedbackSubject', '')),
    },
  });
  fs.writeFileSync(path.join(outDir, htmlName), deckHtml);

  if (opts.partials) {
    const dir = path.join(outDir, 'slides');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const s of slides) {
      fs.writeFileSync(path.join(dir, `${s.file}.html`), renderPartial(s, { css, eyebrow }));
    }
  }

  const manifest = {
    generator: 'markdown-deck',
    id: deckId,
    html: htmlName,
    source: path.relative(outDir, srcPath).split(path.sep).join('/'),
    title,
    version: data.version || '0.1',
    status: data.status || 'Draft',
    cover: Boolean(cover),
    slides: slides.map((s) => ({
      file: s.file, kind: s.kind, label: s.label, title: s.title, ...(s.source ? { source: s.source } : {}),
    })),
    // What the deck was built from, relative to the workspace root, so a workspace can
    // see which decks a change reaches. Includes read sources, not built decks, so these
    // are documents and images, never other decks.
    dependencies: {
      documents: [...documents].map(fromRoot),
      images: [...images].map(([file, check]) => ({
        path: fromRoot(file),
        ...(check ? { source: fromRoot(check.source), stale: !check.fresh } : {}),
      })),
    },
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const wantPdf = pick(opts.pdf, 'deck_pdf', 'pdf', false);
  return { deckHtml, slides, outDir, manifest, pdf: wantPdf === true || wantPdf === 'true' };
}

export { collectSlides, collectCover, slideBody, rewriteImages, rewriteLinks } from './parse.mjs';
