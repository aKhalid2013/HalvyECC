#!/usr/bin/env node
// scripts/generate-po-context.js
// Generates docs/PO-CONTEXT.md from three live repo sources:
//   1. docs/specs/_INDEX.md                              -> spec registry + status
//   2. docs/specs/**/*.report.md                         -> spec-verifier output
//   3. docs/phases/README.md (or phasing-strategy.md)   -> phase completion %

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'docs', 'PO-CONTEXT.md');
const INDEX = path.join(ROOT, 'docs', 'specs', '_INDEX.md');
const PHASES_PRIMARY = path.join(ROOT, 'docs', 'phases', 'README.md');
const PHASES_ALT = path.join(ROOT, 'docs', 'phases', 'phasing-strategy.md');
const PHASES = fs.existsSync(PHASES_PRIMARY) ? PHASES_PRIMARY : PHASES_ALT;
const REPORTS = path.join(ROOT, 'docs', 'specs');

// -- 1. Spec Registry
function extractSpecIndex() {
  if (!fs.existsSync(INDEX)) return '> docs/specs/_INDEX.md not found.\n';
  const lines = fs.readFileSync(INDEX, 'utf8').split('\n');
  return lines.filter((l) => /^(#|##|\|)/.test(l.trim())).join('\n');
}

// -- 2. Verification Reports
function extractVerificationSummaries() {
  const reports = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.report.md')) reports.push(full);
    }
  }
  walk(REPORTS);
  if (!reports.length) return '> No verification reports found yet.\n';

  return reports
    .map((f) => {
      const content = fs.readFileSync(f, 'utf8');
      const specId = content.match(/SPEC-(\d+)/)?.[0] ?? path.basename(f);
      const verdict = content.match(/\*\*Verdict:\*\*\s*(.+)/)?.[1] ?? 'unknown';
      const issues = (content.match(/\|\s*(FAIL|PARTIAL)\s*\|.+/g) ?? [])
        .map((l) => `  - ${l.trim()}`)
        .join('\n');
      return `### ${specId}\n**Verdict:** ${verdict}\n${issues || '  *(no open issues)*'}`;
    })
    .join('\n\n');
}

// -- 3. Phase Completion
function extractPhaseCompletion() {
  if (!fs.existsSync(PHASES)) return `> ${path.relative(ROOT, PHASES)} not found.\n`;
  const text = fs.readFileSync(PHASES, 'utf8');
  const phases = text.split(/^## Phase \d/m).slice(1);
  const phaseHeaders = [...text.matchAll(/^## (Phase \d[^\n]*)/gm)].map((m) => m[1]);

  return phaseHeaders
    .map((header, i) => {
      const block = phases[i] ?? '';
      const done = (block.match(/- \[x\]/gi) ?? []).length;
      const total = (block.match(/- \[(x| )\]/gi) ?? []).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      return `| ${header} | ${done}/${total} | ${pct}% |`;
    })
    .join('\n');
}

// -- Assemble
const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

const output = [
  '# PO-CONTEXT — Halvy Live Progress Snapshot',
  `_Generated: ${now} UTC — do not edit manually_`,
  '',
  '---',
  '',
  '## 1. Spec Registry',
  '',
  extractSpecIndex(),
  '',
  '---',
  '',
  '## 2. Verification Report Summaries',
  '',
  extractVerificationSummaries(),
  '',
  '---',
  '',
  '## 3. Phase Completion',
  '',
  '| Phase | Deliverables | Completion |',
  '|-------|-------------|------------|',
  extractPhaseCompletion(),
  '',
  '---',
  '_End of snapshot. Paste or upload this file at the start of a PO Agent session._',
].join('\n');

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, output);
