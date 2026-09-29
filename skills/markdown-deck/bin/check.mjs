#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Post-install check for markdown-deck (DD-11 of AI-Assisted Work).
 *
 * Run from the workspace root, with SKILL_DIR set to the installed skill's directory.
 * Checks Node.js 18 or newer, that `npm install` has been run in the skill (its
 * dependencies resolve from it), and, where the workspace binds [suite.markdown-deck] in
 * .agents/skill-bindings.toml, that the binding parses, its theme exists, its palette
 * names only known tokens and its mermaid and registry paths resolve. Playwright is
 * optional: without it only PDF export is unavailable, which is a warning.
 *
 * Exit 0: correct (warnings may be printed). Exit 1: problems, one line each.
 * Exit 2: usage or environment error. Offline and read-only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  console.error(`Node.js ${process.versions.node} is too old: markdown-deck needs 18 or newer.`);
  process.exit(2);
}
if (['-h', '--help'].includes(process.argv[2]) && process.argv.length === 3) {
  console.log('usage: check.mjs   (run from the workspace root, with SKILL_DIR set; exit 0 ok, 1 problems, 2 usage or environment)');
  process.exit(0);
}
if (process.argv.length > 2) {
  console.error('usage: check.mjs   (run from the workspace root; takes no arguments)');
  process.exit(2);
}

const here = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const skillDir = process.env.SKILL_DIR ? path.resolve(process.env.SKILL_DIR) : here;
const problems = [];
const warnings = [];

/** Whether a package resolves from the skill the way Node would find it. */
function installed(name) {
  for (let d = skillDir; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'node_modules', name, 'package.json'))) return true;
    if (path.dirname(d) === d) return false;
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(skillDir, 'package.json'), 'utf8'));
const missing = Object.keys(pkg.dependencies ?? {}).filter((d) => !installed(d));
if (missing.length) {
  problems.push(`${skillDir}: ${missing.join(', ')} not installed. Run npm install in ${skillDir}.`);
}
for (const d of Object.keys(pkg.optionalDependencies ?? {})) {
  if (!installed(d)) warnings.push(`${d} is not installed, so PDF export is unavailable. Run npm install in ${skillDir} to add it.`);
}

const { findBindings, readSection, SECTION } = await import(pathToFileURL(path.join(skillDir, 'src', 'bindings.mjs')).href);
const file = findBindings(process.cwd());
if (file) {
  let values = null;
  try {
    values = readSection(fs.readFileSync(file, 'utf8'), SECTION, file);
  } catch (e) {
    problems.push(`${e.message}. Fix [${SECTION}] in that file.`);
  }
  if (values) {
    const base = path.dirname(file);
    const exists = (p) => fs.existsSync(path.resolve(base, p)) || fs.existsSync(path.resolve(p));
    const themes = fs.readdirSync(path.join(skillDir, 'themes'))
      .filter((f) => f.endsWith('.css') && !f.startsWith('_'))
      .map((f) => f.slice(0, -4));
    if (values.theme !== undefined && !themes.includes(String(values.theme)) && !exists(String(values.theme))) {
      problems.push(`${file}: [${SECTION}] theme ${values.theme} is neither a built-in theme (${themes.join(', ')}) nor a .css file that exists. Name one of those, or correct the path.`);
    }
    if (values.palette && typeof values.palette === 'object' && missing.length === 0) {
      const { PALETTE_TOKENS } = await import(pathToFileURL(path.join(skillDir, 'src', 'index.mjs')).href);
      for (const k of Object.keys(values.palette)) {
        if (!PALETTE_TOKENS.includes(k)) {
          problems.push(`${file}: [${SECTION}.palette] ${k} is not a palette token, and a build stops on it. Known tokens: ${PALETTE_TOKENS.join(', ')}.`);
        }
      }
    }
    if (typeof values.mermaid === 'string' && !/^https?:\/\//.test(values.mermaid) && !fs.existsSync(path.resolve(base, values.mermaid))) {
      warnings.push(`${file}: [${SECTION}] mermaid ${values.mermaid} does not exist, so decks with diagrams load mermaid from the CDN.`);
    }
    if (typeof values.registry === 'string' && !fs.existsSync(path.dirname(path.resolve(base, values.registry)))) {
      problems.push(`${file}: [${SECTION}] registry ${values.registry} is in a folder that does not exist. Create the folder, or correct the path.`);
    }
  }
}

for (const w of warnings) console.log(`warning: ${w}`);
for (const p of problems) console.log(p);
if (problems.length === 0) console.log('markdown-deck: ok');
process.exit(problems.length ? 1 : 0);
