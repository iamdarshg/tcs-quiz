import fs from 'node:fs';

export function buildPrepLibrary(sourceText) {
  const modules = [];
  let current = { id: '00', title: 'Roadmap and introduction', lines: [] };
  modules.push(current);
  let moduleNumber = 0;
  String(sourceText).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').forEach((raw, index) => {
    const text = raw.trim();
    if (!text) return;
    const heading = text.match(/^(\d{1,2})\.\s+(.+)/);
    if (heading && Number(heading[1]) > moduleNumber) {
      moduleNumber = Number(heading[1]);
      current = { id: String(moduleNumber).padStart(2, '0'), title: heading[2], lines: [] };
      modules.push(current);
    }
    current.lines.push({ sourceLine: index + 1, text });
  });
  return { sourceLineCount: modules.reduce((count, module) => count + module.lines.length, 0), modules: modules.filter((module) => module.lines.length) };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  const [, , input, output] = process.argv;
  if (!input || !output) throw new Error('Usage: node scripts/build-prep-library.mjs <input.txt> <output.json>');
  fs.writeFileSync(output, JSON.stringify(buildPrepLibrary(fs.readFileSync(input, 'utf8'))));
}
