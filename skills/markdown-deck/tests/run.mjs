// SPDX-License-Identifier: Apache-2.0
// Runs every tests/*.test.mjs with Node's built-in test runner. Node 18 does not expand a
// glob given to --test, and Windows shells do not expand one either, so the files are
// listed here instead of in package.json.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => path.join(dir, f));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
