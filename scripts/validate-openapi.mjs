import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const text = await readFile(new URL('../openapi.yaml', import.meta.url), 'utf8');
const required = ['openapi: 3.1.0', 'info:', 'servers:', 'paths:', 'components:', '/health:', '/v1/month/{year}/{month}:', '/v1/year/{year}:', '/v1/range:', '/v1/print-layout/{year}/{month}:', '/v1/blank-grid:', '/v1/topology/{year}/{month}:', '/v1/compare:', '/v1/references/{slug}:', 'BadRequest:', 'NotFound:'];
for (const fragment of required) if (!text.includes(fragment)) throw new Error(`OpenAPI definition is missing ${fragment}`);
if (/betacalendars\.com\/[^\s'"}]+[?&](utm_|ref=|source=)/.test(text)) throw new Error('A canonical project URL contains a tracking parameter');
const ruby = spawnSync('ruby', ['-ryaml', '-e', 'spec = YAML.load_file(ARGV.fetch(0)); abort "OpenAPI paths missing" unless spec.is_a?(Hash) && spec.dig("paths", "/v1/month/{year}/{month}"); abort "Expected nine API paths" unless spec.fetch("paths").size == 9; puts "YAML parser accepted #{spec.fetch("paths").size} paths"', new URL('../openapi.yaml', import.meta.url).pathname], { encoding: 'utf8' });
if (ruby.status !== 0) throw new Error(`OpenAPI YAML parsing failed: ${ruby.stderr || ruby.stdout}`);
process.stdout.write(`OpenAPI YAML and structural checks passed (${required.length} required markers). ${ruby.stdout.trim()}\n`);
