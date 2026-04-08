#!/usr/bin/env node
// scripts/generate-process-feedback.js
// Aggregates feedback-logs/ into docs/PROCESS-FEEDBACK.md
// for the Process Improvement Agent to consume.
//
// Usage: node scripts/generate-process-feedback.js
// Trigger: GitHub Action (process-feedback-sync.yml) or manual

const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const OUTPUT   = path.join(ROOT, 'docs', 'PROCESS-FEEDBACK.md');
const SESSIONS = path.join(ROOT, 'feedback-logs', 'sessions');
const VERIFS   = path.join(ROOT, 'feedback-logs', 'verifications');
const OBS      = path.join(ROOT, 'feedback-logs', 'observations');

function readJsonDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => {
      const filePath = path.join(dir, f);
      try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
      catch (err) {
        console.warn('Warning: failed to parse JSON file ' + filePath + ': ' + err.message);
        return null;
      }
    })
    .filter(Boolean);
}

function sessionStats(sessions) {
  if (!sessions.length) return '> No session logs recorded yet.\n';

  const total = sessions.length;
  const platforms = {};
  const phases = {};
  const outcomes = {};
  let totalDuration = 0;
  let totalInterventions = 0;
  const allIssues = [];
  const allViolations = [];

  sessions.forEach(s => {
    platforms[s.platform] = (platforms[s.platform] || 0) + 1;
    phases[s.workflow_phase] = (phases[s.workflow_phase] || 0) + 1;
    outcomes[s.outcome] = (outcomes[s.outcome] || 0) + 1;
    totalDuration += s.duration_minutes || 0;
    totalInterventions += s.human_interventions || 0;
    (s.issues || []).forEach(i => allIssues.push(i));
    (s.rules_violated || []).forEach(r => allViolations.push(r));
  });

  const avgDuration = Math.round(totalDuration / total);

  const lines = [
    '- **Total sessions:** ' + total,
    '- **Average duration:** ' + avgDuration + ' minutes',
    '- **Human interventions:** ' + totalInterventions + ' total (' + (totalInterventions / total).toFixed(1) + ' per session)',
    '',
    '**By platform:**',
  ];
  Object.entries(platforms).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    lines.push('- ' + k + ': ' + v + (v === 1 ? ' session' : ' sessions'));
  });
  lines.push('', '**By workflow phase:**');
  Object.entries(phases).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    lines.push('- ' + k + ': ' + v + (v === 1 ? ' session' : ' sessions'));
  });
  lines.push('', '**By outcome:**');
  Object.entries(outcomes)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([k, v]) => {
      lines.push('- ' + k + ': ' + v);
    });

  if (allIssues.length) {
    const issueTypes = {};
    let totalTimeLost = 0;
    allIssues.forEach(i => {
      issueTypes[i.type] = (issueTypes[i.type] || 0) + 1;
      totalTimeLost += i.time_lost_minutes || 0;
    });
    lines.push('', '**Issue frequency:**', '');
    lines.push('| Type | Count | Time lost |');
    lines.push('|------|-------|-----------|');
    Object.entries(issueTypes).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      const lost = allIssues.filter(i => i.type === type).reduce((sum, i) => sum + (i.time_lost_minutes || 0), 0);
      lines.push('| ' + type + ' | ' + count + ' | ' + lost + ' min |');
    });
    lines.push('', '**Total time lost to issues:** ' + totalTimeLost + ' minutes');
  }

  if (allViolations.length) {
    const violCounts = {};
    allViolations.forEach(v => violCounts[v] = (violCounts[v] || 0) + 1);
    lines.push('', '**Rule violations:**', '');
    lines.push('| Rule | Violations |');
    lines.push('|------|------------|');
    Object.entries(violCounts).sort((a, b) => b[1] - a[1]).forEach(([rule, count]) => {
      lines.push('| ' + rule + ' | ' + count + ' |');
    });
  }

  return lines.join('\n');
}

function verificationStats(verifs) {
  if (!verifs.length) return '> No verification results recorded yet.\n';

  const total = verifs.length;
  const verdicts = {};
  const failCategories = {};

  verifs.forEach(v => {
    verdicts[v.verdict] = (verdicts[v.verdict] || 0) + 1;
    (v.failure_categories || []).forEach(c => {
      failCategories[c] = (failCategories[c] || 0) + 1;
    });
  });

  const passRate = verdicts['PASS'] ? Math.round((verdicts['PASS'] / total) * 100) : 0;

  const lines = [
    '- **Total verifications:** ' + total,
    '- **PASS rate:** ' + passRate + '%',
  ];
  const VERDICT_ORDER = { PASS: 0, PARTIAL: 1, FAIL: 2 };
  Object.entries(verdicts)
    .sort((a, b) => (VERDICT_ORDER[a[0]] ?? 3) - (VERDICT_ORDER[b[0]] ?? 3))
    .forEach(([k, v]) => {
      lines.push('- ' + k + ': ' + v);
    });

  if (Object.keys(failCategories).length) {
    lines.push('', '**Failure categories:**', '');
    lines.push('| Category | Occurrences |');
    lines.push('|----------|-------------|');
    Object.entries(failCategories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      lines.push('| ' + cat + ' | ' + count + ' |');
    });
  }

  return lines.join('\n');
}

function observationSummary(observations) {
  if (!observations.length) return '> No observations recorded yet.\n';

  return observations
    .sort((a, b) => {
      const sev = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = (sev[a.severity] || 3) - (sev[b.severity] || 3);
      if (severityDiff !== 0) return severityDiff;
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      const titleDiff = (a.title || '').localeCompare(b.title || '');
      if (titleDiff !== 0) return titleDiff;
      return (a.category || '').localeCompare(b.category || '');
    })
    .map(o => {
      const lines = ['### [' + (o.severity || 'medium').toUpperCase() + '] ' + o.title];
      lines.push('**Category:** ' + o.category + ' | **Date:** ' + o.date);
      lines.push('', o.description);
      if (o.proposed_fix) lines.push('', '**Proposed fix:** ' + o.proposed_fix);
      if (o.related_specs && o.related_specs.length) {
        lines.push('**Related specs:** ' + o.related_specs.join(', '));
      }
      return lines.join('\n');
    })
    .join('\n\n---\n\n');
}

function generateRecommendations(sessions, verifs, observations) {
  const recs = [];

  const issueTypes = {};
  sessions.forEach(s => (s.issues || []).forEach(i => {
    issueTypes[i.type] = (issueTypes[i.type] || 0) + 1;
  }));
  Object.entries(issueTypes).filter(([_, count]) => count >= 3).forEach(([type, count]) => {
    recs.push('- **Recurring issue: ' + type + '** (' + count + ' occurrences) — investigate root cause in skills/rules');
  });

  if (verifs.length >= 3) {
    const passCount = verifs.filter(v => v.verdict === 'PASS').length;
    const rate = Math.round((passCount / verifs.length) * 100);
    if (rate < 70) {
      recs.push('- **Low verification PASS rate (' + rate + '%)** — review spec template clarity and TDD enforcement');
    }
  }

  if (sessions.length >= 3) {
    const avgInterventions = sessions.reduce((s, x) => s + (x.human_interventions || 0), 0) / sessions.length;
    if (avgInterventions > 2) {
      recs.push('- **High human intervention rate (' + avgInterventions.toFixed(1) + '/session)** — agents may need better context loading');
    }
  }

  observations.filter(o => o.severity === 'critical' || o.severity === 'high').forEach(o => {
    recs.push('- **[' + o.severity.toUpperCase() + '] ' + o.title + '** — ' + (o.proposed_fix || 'needs investigation'));
  });

  const violCounts = {};
  sessions.forEach(s => (s.rules_violated || []).forEach(r => {
    violCounts[r] = (violCounts[r] || 0) + 1;
  }));
  Object.entries(violCounts).filter(([_, count]) => count >= 2).forEach(([rule, count]) => {
    recs.push('- **Repeated rule violation: ' + rule + '** (' + count + 'x) — consider promoting to a blocking check');
  });

  return recs.length ? recs.join('\n') : '> Not enough data yet to generate recommendations.\n';
}

// ── Assemble ──
const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
const sessions = readJsonDir(SESSIONS);
const verifs = readJsonDir(VERIFS);
const observations = readJsonDir(OBS);

const output = [
  '# PROCESS-FEEDBACK — AI Dev System Operational Digest',
  '_Generated: ' + now + ' UTC — do not edit manually_',
  '',
  '---',
  '',
  '## 1. Session summary',
  '',
  sessionStats(sessions),
  '',
  '---',
  '',
  '## 2. Verification results',
  '',
  verificationStats(verifs),
  '',
  '---',
  '',
  '## 3. Observations & patterns',
  '',
  observationSummary(observations),
  '',
  '---',
  '',
  '## 4. Recommendations',
  '',
  generateRecommendations(sessions, verifs, observations),
  '',
  '---',
  '_End of digest. Upload this file at the start of a Process Improvement session._',
].join('\n');

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, output);
console.log('PROCESS-FEEDBACK.md written to ' + path.relative(ROOT, OUTPUT));
