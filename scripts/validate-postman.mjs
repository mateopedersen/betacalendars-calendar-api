import { readFile } from 'node:fs/promises';
const files = ['BetaCalendars-Getting-Started.postman_collection.json', 'BetaCalendars-API-Reference.postman_collection.json'];
let requestCount = 0;
for (const file of files) {
  const collection = JSON.parse(await readFile(new URL(`../postman/${file}`, import.meta.url), 'utf8'));
  if (!collection.info.schema.endsWith('/v2.1.0/collection.json')) throw new Error(`${file} has an unexpected collection format`);
  if (!collection.variable.some((variable) => variable.key === 'baseUrl' && variable.value === 'https://api.betacalendars.com')) throw new Error(`${file} must use the public baseUrl`);
  const visit = (items) => { for (const item of items) { if (item.request) { requestCount++; if (item.request.method !== 'GET') throw new Error(`${item.name} is not read-only`); if (!item.event?.some((event) => event.listen === 'test')) throw new Error(`${item.name} is missing Postman tests`); } else if (item.item) visit(item.item); } };
  visit(collection.item);
}
const environment = JSON.parse(await readFile(new URL('../postman/BetaCalendars-Public.postman_environment.json', import.meta.url), 'utf8'));
if (environment.values.some((value) => /token|secret|cookie|key/i.test(value.key) && value.value)) throw new Error('Public environment contains a likely secret');
process.stdout.write(`Postman collection checks passed (${requestCount} GET requests, each with a test script).\n`);
