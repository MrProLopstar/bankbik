import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const SOURCE = 'https://www.cbr.ru/s/newbik';
const FILE = 'src/data.ts';
const LOCAL = process.argv[2];

const unzip = (zip: Buffer): Buffer => {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('not a zip archive');
  const central = zip.readUInt32LE(end + 16);
  const method = zip.readUInt16LE(central + 10);
  const size = zip.readUInt32LE(central + 20);
  const local = zip.readUInt32LE(central + 42);
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const body = zip.subarray(start, start + size);
  if (method === 0) return body;
  if (method === 8) return inflateRawSync(body);
  throw new Error(`unsupported zip method ${method}`);
};

const download = async (): Promise<string> => {
  const bytes = LOCAL
    ? readFileSync(LOCAL)
    : Buffer.from(await (await fetch(SOURCE, { headers: { 'user-agent': 'Mozilla/5.0 bankbik' } })).arrayBuffer());
  const xml = bytes[0] === 0x50 ? unzip(bytes) : bytes;
  return new TextDecoder('windows-1251').decode(xml);
};

const ENTITIES: Readonly<Record<string, string>> = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" };

const attributes = (tag: string): Record<string, string> =>
  Object.fromEntries([...tag.matchAll(/(\w+)="([^"]*)"/g)].map(([, key = '', value = '']) => [key, value.replace(/&(\w+);/g, (match, name: string) => ENTITIES[name] ?? match)]));

const xml = await download();
const header = attributes(/<ED807[^>]*>/.exec(xml)?.[0] ?? '');
if (!header['EDDate']) throw new Error('ED807 header not found');

const entries = [...xml.matchAll(/<BICDirectoryEntry BIC="(\d{9})">([\s\S]*?)<\/BICDirectoryEntry>/g)].map(([, bik = '', body = '']) => {
  const info = attributes(/<ParticipantInfo[^>]*>/.exec(body)?.[0] ?? '');
  if (!info['NameP'] || !info['PtType']) throw new Error(`${bik}: no participant info`);
  const accounts = [...body.matchAll(/<Accounts[^>]*>/g)].map(([tag]) => {
    const account = attributes(tag);
    return [account['Account'] ?? '', account['RegulationAccountType'] ?? '', account['AccountStatus'] === 'ACAC' ? 1 : 0, account['DateIn'] ?? '', account['DateOut'] ?? ''];
  });
  const restrictions = [...body.matchAll(/<RstrList[^>]*>/g)].map(([tag]) => {
    const restriction = attributes(tag);
    return [restriction['Rstr'] ?? '', restriction['RstrDate'] ?? ''];
  });
  const swift = [...body.matchAll(/<SWBICS[^>]*>/g)].map(([tag]) => attributes(tag)).sort((a, b) => Number(b['DefaultSWBIC'] ?? 0) - Number(a['DefaultSWBIC'] ?? 0))[0]?.['SWBIC'] ?? '';
  return [
    bik,
    info['NameP'],
    info['EnglName'] ?? '',
    info['PtType'],
    info['RegN'] ?? '',
    info['Rgn'] ?? '',
    info['Ind'] ?? '',
    [info['Tnp'], info['Nnp']].filter(Boolean).join(' '),
    info['Adr'] ?? '',
    info['DateIn'] ?? '',
    info['PrntBIC'] ?? '',
    swift,
    accounts,
    restrictions,
  ];
}).sort((a, b) => String(a[0]).localeCompare(String(b[0])));

if (entries.length < 1000) throw new Error(`only ${entries.length} entries, refusing to write suspicious data`);
const sber = entries.find((entry) => entry[0] === '044525225');
if (!sber || !JSON.stringify(sber).includes('30101810400000000225')) throw new Error('Sberbank 044525225 is missing, refusing to write suspicious data');

const body = `export const ENTRIES: readonly Entry[] = ${JSON.stringify(entries)};`;
const head = "import type { Entry } from './entry.js';\n";
const previous = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
if (previous.endsWith(`${body}\n`)) {
  console.log(`${FILE}: up to date`);
} else {
  writeFileSync(FILE, `${head}\nexport const UPDATED: string = '${header['EDDate']}';\n${body}\n`);
  console.log(`${FILE}: ${entries.length} entries as of ${header['EDDate']}`);
}
