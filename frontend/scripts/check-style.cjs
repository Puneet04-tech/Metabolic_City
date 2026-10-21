#!/usr/bin/env node
/**
 * Style guard.
 *
 * Three rules that Stylelint cannot express precisely on its own:
 *
 *  1. Every `var(--x)` in a stylesheet must resolve to a custom property that
 *     is actually defined — in `src/styles/tokens.css` or locally in the same
 *     file. An unresolved reference is a silent failure: the declaration is
 *     dropped at computed-value time and the element falls back to an
 *     inherited colour.
 *
 *  2. `!important` is banned everywhere except inside a
 *     `@media (prefers-reduced-motion: reduce)` block in `base.css`, where it
 *     is the only way to reliably neutralise animations.
 *
 *  3. Raw colour literals (`#hex`, `rgb()`, `rgba()`, `hsl()`, `hsla()`) may
 *     only appear in `src/styles/tokens.css`. Stylelint's `color-no-hex`
 *     covers hex but not the functional forms.
 */
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src');
const TOKENS = path.join(SRC, 'styles', 'tokens.css');
const BASE = path.join(SRC, 'styles', 'base.css');

const collectCssFiles = (dir, out = []) => {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectCssFiles(full, out);
    else if (entry.name.endsWith('.css')) out.push(full);
  }
  return out;
};

const definedTokens = (source) => {
  const names = new Set();
  for (const match of source.matchAll(/(--[a-z0-9-]+)\s*:/g)) names.add(match[1]);
  return names;
};

const global = definedTokens(fs.readFileSync(TOKENS, 'utf8'));
const local = new Map();
const files = collectCssFiles(SRC);

for (const file of files) {
  if (file === TOKENS) continue;
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/(--[a-z0-9-]+)\s*:/g)) {
    if (!local.has(match[1])) local.set(match[1], path.relative(SRC, file));
  }
}

const problems = [];
const report = (file, line, message) => {
  problems.push(`${path.relative(SRC, file)}:${line}  ${message}`);
};

/** Tracks whether a line sits inside a prefers-reduced-motion block. */
const reducedMotionLines = (source) => {
  const lines = new Set();
  let depth = 0;
  let inReducedMotion = false;
  source.split(/\r?\n/).forEach((line, index) => {
    if (/@media[^{]*prefers-reduced-motion\s*:\s*reduce/.test(line)) inReducedMotion = true;
    if (inReducedMotion) lines.add(index + 1);
    depth += (line.match(/\{/g) || []).length;
    depth -= (line.match(/\}/g) || []).length;
    if (inReducedMotion && depth <= 0) inReducedMotion = false;
  });
  return lines;
};

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const isTokenFile = file === TOKENS;
  const allowed = isTokenFile ? new Set() : reducedMotionLines(source);

  source.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;

    // 1. Unresolved custom properties.
    for (const match of line.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
      const name = match[1];
      if (global.has(name) || local.has(name)) continue;
      report(file, lineNumber, `unresolved custom property ${name}`);
    }

    // 2. !important outside the reduced-motion block.
    if (!isTokenFile && /!important/.test(line) && !allowed.has(lineNumber)) {
      report(file, lineNumber, '!important is only allowed inside a prefers-reduced-motion block');
    }

    // 3. Raw colour literals outside the token file.
    if (!isTokenFile) {
      const withoutVar = line.replace(/var\(\s*--[a-z0-9-]+\s*(?:,[^)]*)?\)/g, '');
      const colour = withoutVar.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
      if (colour) {
        report(file, lineNumber, `raw colour literal "${colour[0]}" — use a token`);
      }
    }
  });
}

if (problems.length) {
  console.error(`Style check failed (${problems.length}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`Style check passed: ${files.length} stylesheets, no unresolved tokens, no stray !important, no raw colours.`);
