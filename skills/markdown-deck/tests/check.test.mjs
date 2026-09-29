// SPDX-License-Identifier: Apache-2.0
// The post-install check: exit 0 when the workspace is right, 1 with one line per problem.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CHECK = path.join(SKILL, 'bin', 'check.mjs');

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-check-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const bind = (text) => {
  fs.mkdirSync(path.join(dir, '.agents'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.agents', 'skill-bindings.toml'), text);
};
const run = (...args) => spawnSync(process.execPath, [CHECK, ...args], {
  cwd: dir, env: { ...process.env, SKILL_DIR: SKILL }, encoding: 'utf8',
});

test('a workspace with no bindings passes', () => {
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /markdown-deck: ok/);
});

test('a bound built-in theme and known palette tokens pass', () => {
  bind('[suite.markdown-deck]\ntheme = "default"\n\n[suite.markdown-deck.palette]\nheading = "#143a5a"\n');
  assert.equal(run().status, 0);
});

test('an unknown theme is a problem, named on one line', () => {
  bind('[suite.markdown-deck]\ntheme = "no-such-theme"\n');
  const r = run();
  assert.equal(r.status, 1);
  assert.match(r.stdout, /theme no-such-theme is neither a built-in theme/);
});

test('an unknown palette token is a problem', () => {
  bind('[suite.markdown-deck.palette]\nheadng = "#143a5a"\n');
  const r = run();
  assert.equal(r.status, 1);
  assert.match(r.stdout, /headng is not a palette token/);
});

test('a binding that does not parse is a problem', () => {
  bind('[suite.markdown-deck]\ntheme = "default\n');
  assert.equal(run().status, 1);
});

test('an argument is a usage error', () => {
  assert.equal(run('--nope').status, 2);
});

test('named palettes, a palette picked by name and a bound background pass', () => {
  fs.mkdirSync(path.join(dir, '.agents', 'art'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.agents', 'art', 'bg.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  bind('[suite.markdown-deck]\npalette = "dusk"\nbackground = { image = "art/bg.svg", wash = 0.2 }\n\n'
    + '[suite.markdown-deck.palettes.dusk]\nheading = "#3b2f5c"\n');
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('an unknown scheme name, or an unknown token in a scheme, is a problem', () => {
  bind('[suite.markdown-deck]\npalette = "dawn"\n\n[suite.markdown-deck.palettes.dusk]\nheading = "#3b2f5c"\n');
  let r = run();
  assert.equal(r.status, 1);
  assert.match(r.stdout, /no palette named "dawn"\. Known: dusk, or none/);
  bind('[suite.markdown-deck.palettes.dusk]\nheadng = "#3b2f5c"\n');
  r = run();
  assert.equal(r.status, 1);
  assert.match(r.stdout, /dusk: unknown palette token: headng/);
});

test('a missing background image, or one of an unsupported type, is a problem', () => {
  bind('[suite.markdown-deck]\nbackground = "art/gone.png"\n');
  let r = run();
  assert.equal(r.status, 1);
  assert.match(r.stdout, /background image art\/gone\.png does not exist/);
  bind('[suite.markdown-deck.background]\nimage = "art/bg.gif"\n');
  r = run();
  assert.equal(r.status, 1);
  assert.match(r.stdout, /art\/bg\.gif is not a supported image type/);
});
