// Compara o texto visível atual com o snapshot do site original.
//   node tests/text-diff.mjs --snapshot <url>   grava baseline/texto-original.json
//   node tests/text-diff.mjs [url]              compara (padrão: preview em :4173)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { launch, extractCopy } from './lib.mjs';

const args = process.argv.slice(2);
const snapshot = args[0] === '--snapshot';
const url = (snapshot ? args[1] : args[0]) ?? 'http://localhost:4173/';
const baselinePath = new URL('../baseline/texto-original.json', import.meta.url);

const browser = await launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
const copy = await extractCopy(page);
await browser.close();

if (snapshot) {
  await mkdir(new URL('../baseline/', import.meta.url), { recursive: true });
  await writeFile(baselinePath, JSON.stringify(copy, null, 2));
  await writeFile(new URL('../baseline/texto-original.txt', import.meta.url), copy.text.replace(/([.!?]) /g, '$1\n') + '\n');
  console.log(`Snapshot gravado (${copy.text.length} caracteres).`);
  process.exit(0);
}

const base = JSON.parse(await readFile(baselinePath, 'utf8'));
let failed = false;

// Diff por palavra (LCS) para mostrar exatamente o que mudou.
function wordDiff(a, b) {
  const x = a.split(' '), y = b.split(' ');
  const dp = Array.from({ length: x.length + 1 }, () => new Uint16Array(y.length + 1));
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) { i++; j++; }
    else if (j < y.length && (i === x.length || dp[i][j + 1] >= dp[i + 1][j])) out.push(`+ ${y[j++]}`);
    else out.push(`- ${x[i++]}`);
  }
  return out;
}

const report = (label, ok, detail) => {
  console.log(`${ok ? '✔' : '✘'} ${label}`);
  if (!ok) { failed = true; if (detail) console.log(detail); }
};

report('Título da página', base.title === copy.title, `  antes: ${base.title}\n  depois: ${copy.title}`);
const d = wordDiff(base.text, copy.text);
report(`Texto visível (${base.text.split(' ').length} palavras)`, d.length === 0, d.map((l) => '  ' + l).join('\n'));
const missingAttrs = base.attrs.filter((a) => !copy.attrs.includes(a));
report('alt / aria-label originais preservados', missingAttrs.length === 0, missingAttrs.map((a) => '  falta ' + a).join('\n'));
const newAttrs = copy.attrs.filter((a) => !base.attrs.includes(a));
if (newAttrs.length) console.log('ℹ atributos acessíveis novos:\n' + newAttrs.map((a) => '  + ' + a).join('\n'));
const linkDiff = [...base.links.filter((l) => !copy.links.includes(l)).map((l) => '  - ' + l), ...copy.links.filter((l) => !base.links.includes(l)).map((l) => '  + ' + l)];
if (linkDiff.length) console.log('ℹ links alterados (conferir se intencionais):\n' + linkDiff.join('\n'));

process.exit(failed ? 1 : 0);
