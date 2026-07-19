import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argv, exit } from 'node:process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifestPath = join(root, 'content', 'card-art.sources.json');
const catalogPath = join(root, 'content', 'cards.json');
const out = join(root, 'apps', 'web', 'public', 'cards');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const cards = Object.entries(manifest.cards);
const fileFor = (id) => `${id}.png`;

async function validateManifest() {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const catalogIds = catalog.map(({ id }) => id).sort();
  const manifestIds = cards.map(([id]) => id).sort();
  if (JSON.stringify(catalogIds) !== JSON.stringify(manifestIds))
    throw new Error('catalog/manifest parity mismatch');

  const required = [
    'title',
    'codepoint',
    'sourceUrl',
    'localFile',
    'project',
    'creator',
    'license',
    'modifications',
  ];
  const seen = new Set();
  for (const [id, source] of cards) {
    for (const field of required) {
      if (typeof source[field] !== 'string' || !source[field].trim())
        throw new Error(`missing ${field}: ${id}`);
    }
    if (seen.has(source.codepoint))
      throw new Error(`duplicate source mapping: ${source.codepoint}`);
    seen.add(source.codepoint);
    const expectedUrl = `${manifest.sourceBase}/${source.codepoint}.png`;
    if (source.sourceUrl !== expectedUrl) throw new Error(`unpinned source URL: ${id}`);
    if (source.localFile !== `apps/web/public/cards/${fileFor(id)}`)
      throw new Error(`invalid local filename: ${id}`);
    if (source.project !== 'OpenMoji 17.0' || source.creator !== 'OpenMoji contributors')
      throw new Error(`invalid attribution: ${id}`);
    if (source.license !== 'CC BY-SA 4.0') throw new Error(`invalid license: ${id}`);
  }
}

async function fetchAssets() {
  await validateManifest();
  await mkdir(out, { recursive: true });
  for (const [id, source] of cards) {
    const path = join(out, fileFor(id));
    const response = await fetch(source.sourceUrl);
    if (!response.ok) throw new Error(`${response.status} ${source.codepoint}`);
    await writeFile(path, Buffer.from(await response.arrayBuffer()));
  }
}

async function check() {
  await validateManifest();
  const files = (await readdir(out)).filter((name) => name.endsWith('.png')).sort();
  const expected = cards.map(([id]) => fileFor(id)).sort();
  if (JSON.stringify(files) !== JSON.stringify(expected))
    throw new Error('catalog/file parity mismatch');
  for (const [id] of cards) {
    const bytes = await readFile(join(out, fileFor(id)));
    if (bytes.readUInt32BE(0) !== 0x89504e47) throw new Error(`not PNG: ${id}`);
    if (bytes.length < 24) throw new Error(`image too small: ${id}`);
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (width < 618 || height < 618 || width !== height)
      throw new Error(`invalid dimensions ${width}x${height}: ${id}`);
  }
}

if (argv[2] === 'fetch') await fetchAssets();
else if (argv[2] === 'check') await check();
else exit(2);
