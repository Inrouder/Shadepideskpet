// Schnelle Prüfung: Syntax aller Skripte + vorhandene Assets.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let bad = 0;
for (const dir of ['main', 'app/js', 'tools']) {
  for (const f of fs.readdirSync(path.join(root, dir))) {
    if (!f.endsWith('.js')) continue;
    try { execFileSync(process.execPath, ['--check', path.join(root, dir, f)]); } catch (e) { bad++; console.error('Syntaxfehler:', dir + '/' + f); }
  }
}
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
for (const m of html.matchAll(/src="([^"]+)"/g)) if (!fs.existsSync(path.join(root, 'app', m[1]))) { bad++; console.error('Fehlt:', m[1]); }
const assets = fs.readFileSync(path.join(root, 'app/js/assets.js'), 'utf8');
for (const m of assets.matchAll(/'((?:heroes|enemies|fx|ui)\/[^']+\.png)'/g)) if (!fs.existsSync(path.join(root, 'app/assets', m[1]))) { bad++; console.error('Fehlt:', m[1]); }
if (bad) { console.error(`${bad} Problem(e)`); process.exit(1); }
console.log('Alles in Ordnung.');
