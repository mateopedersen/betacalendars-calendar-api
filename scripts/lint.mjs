import { readFile, readdir } from 'node:fs/promises';
const files = await readdir(new URL('../src/', import.meta.url));
const sourceFiles = files.filter((name) => name.endsWith('.ts'));
for (const name of sourceFiles) {
  const source = await readFile(new URL(`../src/${name}`, import.meta.url), 'utf8');
  if (/[ \t]+$/m.test(source)) throw new Error(`${name} contains trailing whitespace`);
  if (/\beval\s*\(/.test(source)) throw new Error(`${name} must not use eval`);
  if (/console\.log\s*\(/.test(source)) throw new Error(`${name} must not log request data`);
}
process.stdout.write(`Source lint passed (${sourceFiles.length} TypeScript files).\n`);
