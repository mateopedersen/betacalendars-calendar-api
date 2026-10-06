import { readFile } from 'node:fs/promises';
const files = ['README.md', 'openapi.yaml', 'postman/BetaCalendars-Getting-Started.postman_collection.json', 'postman/BetaCalendars-API-Reference.postman_collection.json', 'postman/README.md'];
const contents = new Map(await Promise.all(files.map(async (file) => [file, await readFile(new URL(`../${file}`, import.meta.url), 'utf8')])));
const tracking = /https:\/\/www\.betacalendars\.com\/[^\s"')]*[?&](?:utm_[^=]*|ref=|source=)/i;
for (const [file, text] of contents) if (tracking.test(text)) throw new Error(`${file} contains a tracked Beta Calendars URL`);
const reference = (month) => `https://www.betacalendars.com/${month.toLowerCase()}-calendar.html`;
const collection = JSON.parse(contents.get('postman/BetaCalendars-API-Reference.postman_collection.json'));
const fixtures = collection.item.find((item) => item.name === '2027 Month Examples')?.item ?? [];
if (fixtures.length !== 12) throw new Error(`Expected twelve month fixtures, found ${fixtures.length}`);
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
for (const [index, month] of monthNames.entries()) {
  const item = fixtures.find((fixture) => fixture.name.startsWith(`${month} `));
  if (!item || !item.description.includes(reference(month))) throw new Error(`${month} request is missing its corresponding canonical reference`);
  for (const other of monthNames.filter((value) => value !== month)) if (item.description.includes(reference(other))) throw new Error(`${month} request contains an unrelated month link`);
}
process.stdout.write('Canonical links passed: twelve month fixtures each contain only their matching month URL; no tracking parameters found.\n');
