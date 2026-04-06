#!/usr/bin/env node
// scripts/generate-po-context.js
// Generates docs/PO-CONTEXT.md from three live repo sources:
//   1. docs/specs/_INDEX.md          -> spec registry + status
//   2. docs/specs/**/*.report.md     -> spec-verifier output
//   3. docs/phases/README.md         -> phase completion %

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const OUTPUT  = path.join(ROOT, 'docs', 'PO-CONTEXT.md');
const INDEX   = path.join(ROOT, 'docs', 'specs', '_INDEX.md');
const PHASES  = path.join(ROOT, 'docs', 'phases', 'README.md');
const REPORTS = path.join(ROOT, 'docs', 'specs');

// -- 1. Spec Registry
function extractSpecIndex() {
  if (!fs.existsSync(INDEX)) return '> docs/specs/_INDEX.md not found.\n';
  const lines = fs.readFileSync(INDEX, 'utf8').split('\n');
  return lines
    .filter(l => /^(#|##|\|)/.test(l.trim()))
    // Filter out rows that represent empty states like "No specs yet"
    .filter(l => !/\|\s*—\s*\|\s*No specs yet\s*\|/.test(l.trim()))
    .join('\n');
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

  let totalSpecs = reports.length;
  let passed = 0;
  let partial = 0;
  let failed = 0;

  const summaries = reports.map(f => {
    const content = fs.readFileSync(f, 'utf8');
    const specId  = content.match(/SPEC-(\d+)/)?.[0] ?? path.basename(f);
    const verdict = content.match(/\*\*Verdict:\*\*\s*(.+)/)?.[1] ?? 'unknown';

    if (verdict.includes('PASS') || verdict.includes('✅')) passed++;
    else if (verdict.includes('PARTIAL') || verdict.includes('⚠️')) partial++;
    else if (verdict.includes('FAIL') || verdict.includes('❌')) failed++;

    const issues  = (content.match(/\|\s*(FAIL|PARTIAL)\s*\|.+/g) ?? [])
                      .map(l => '  - ' + l.trim()).join('\n');
    return '- **' + specId + '** (' + verdict.trim() + ')' + (issues ? '\n' + issues : '');
  }).join('\n');

  return `**Total Verifications:** ${totalSpecs} (✅ ${passed} | ⚠️ ${partial} | ❌ ${failed})\n\n${summaries}`;
}

// -- 3. Phase Completion
function extractPhaseCompletion() {
  if (!fs.existsSync(PHASES)) return '> docs/phases/README.md not found.\n';
  const text   = fs.readFileSync(PHASES, 'utf8');
  // Match phase headings flexibly (e.g. ## Phase 1, ## Phase 1:, ## Phase 1 -)
  const phaseHeaders = [...text.matchAll(/^## (Phase \d.*)/gm)].map(m => m[1]);
  if (phaseHeaders.length === 0) return '> No phases found in docs/phases/README.md.\n';

  const phases = text.split(/^## Phase \d.*/m).slice(1);

  return phaseHeaders.map((header, i) => {
    const block = phases[i] ?? '';
    // Support various list formats: - [x], * [x], - [x], etc.
    const done  = (block.match(/^[\s\-\*]*\[[xX]\]/gm) ?? []).length;
    const total = (block.match(/^[\s\-\*]*\[[xX ]\]/gm) ?? []).length;
    const pct   = total ? Math.round((done / total) * 100) : 0;
    return '| ' + header.trim() + ' | ' + done + '/' + total + ' | ' + pct + '% |';
  }).join('\n');
}

// -- Assemble
const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

const output = [
  '# PO-CONTEXT — Halvy Live Progress Snapshot',
  '_Generated: ' + now + ' UTC — do not edit manually_',
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
console.log('PO-CONTEXT.md written to ' + path.relative(ROOT, OUTPUT));
