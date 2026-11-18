#!/usr/bin/env node
// Neueste Version auf der Repo-Startseite:
//   node tools/release-info.js notes <datei> [version] → Release-Text (aus CHANGELOG.md)
//   node tools/release-info.js versions        → alle Versionen im CHANGELOG
//   node tools/release-info.js readme          → Kasten „Neueste Version“ in README.md aktualisieren
//   node tools/release-info.js title [version] → Titel einer Version
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPO = 'https://github.com/Inrouder/Shadepideskpet';
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const cmd = process.argv[2];
const version = (cmd === 'notes' ? process.argv[4] : cmd === 'title' ? process.argv[3] : null) || pkg.version;
const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');

// Abschnitt „## 1.6.0 · Datum · Titel“ bis zur nächsten Versionsüberschrift
function section(v) {
  const lines = changelog.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## ${v} `) || l.trim() === `## ${v}`);
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (end < 0) end = lines.length;
  const head = lines[start].replace(/^##\s*/, '').split('·').map((s) => s.trim());
  return { date: head[1] || '', title: head[2] || '', body: lines.slice(start + 1, end).join('\n').trim() };
}

if (cmd === 'versions') {
  console.log([...changelog.matchAll(/^## (\d+\.\d+\.\d+)/gm)].map((m) => m[1]).join('\n'));
  process.exit(0);
}
const sec = section(version);
if (!sec) { console.error(`CHANGELOG.md hat keinen Abschnitt für ${version}`); process.exit(1); }

const setup = `${REPO}/releases/download/v${version}/Shadepi-Deskpet-${version}-Setup.exe`;
const portable = `${REPO}/releases/download/v${version}/Shadepi-Deskpet-${version}-portable.exe`;
const page = `${REPO}/releases/tag/v${version}`;

if (cmd === 'notes') {
  const out = process.argv[3] || 'release-notes.md';
  const text = [
    sec.title ? `### ${sec.title}` : '',
    sec.body,
    '',
    '**Herunterladen:** `Shadepi-Deskpet-' + version + '-Setup.exe` (Installation mit automatischen Updates) oder `Shadepi-Deskpet-' + version + '-portable.exe` (ohne Installation).',
    'Bereits installiert? Das Update kommt automatisch – oder im Tray „Nach Updates suchen“.',
  ].filter((l, i) => i > 0 || l).join('\n');
  fs.writeFileSync(out, text + '\n');
  console.log(`Release-Text für ${version} → ${out}`);
} else if (cmd === 'title') {
  process.stdout.write(sec.title);
} else if (cmd === 'readme') {
  const file = path.join(ROOT, 'README.md');
  const readme = fs.readFileSync(file, 'utf8');
  const box = [
    '<!-- neueste-version:start (wird beim Veröffentlichen automatisch aktualisiert) -->',
    `> ### ⬇️ Neueste Version: [${version}](${page})${sec.date ? ` · ${sec.date}` : ''}${sec.title ? ` · ${sec.title}` : ''}`,
    '>',
    `> **[Installer herunterladen](${setup})** (mit automatischen Updates) · **[Portable Version](${portable})** (ohne Installation) · [alle Versionen](${REPO}/releases) · [Änderungen](CHANGELOG.md)`,
    '>',
    ...sec.body.split('\n').map((l) => (l ? `> ${l}` : '>')),
    '<!-- neueste-version:end -->',
  ].join('\n');
  const re = /<!-- neueste-version:start[\s\S]*?<!-- neueste-version:end -->/;
  let next;
  if (re.test(readme)) next = readme.replace(re, box);
  else {
    // direkt unter den einleitenden Absatz (vor das erste Bild)
    const at = readme.indexOf('\n![');
    next = at > 0 ? readme.slice(0, at).trimEnd() + '\n\n' + box + '\n\n' + readme.slice(at + 1) : readme + '\n' + box + '\n';
  }
  if (next !== readme) { fs.writeFileSync(file, next); console.log(`README: neueste Version ${version}`); }
  else console.log('README ist schon aktuell');
} else {
  console.error('Aufruf: node tools/release-info.js notes <datei> | readme');
  process.exit(1);
}
