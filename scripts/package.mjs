// Creates the Chrome Web Store upload from dist/: a zip with manifest.json at
// the top level, named after the manifest version. Run it with `npm run package`,
// which tests and builds first. Uses only Node's built-in zlib.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const DIST = 'dist';

const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
if (manifest.version !== version) {
  fail(`public/manifest.json is version ${manifest.version} but package.json is ${version}. Make them match.`);
}
if (!/^\d+(\.\d+){0,3}$/.test(manifest.version)) {
  fail(`"${manifest.version}" isn't a valid extension version (use up to four numbers, like 1.0.1).`);
}

function listFiles(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? listFiles(path) : [path];
    });
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

// A fixed timestamp (1 January 1980, the earliest a zip can hold) means the
// same code always produces the same zip.
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;

const records = [];
const directory = [];
let offset = 0;
const files = listFiles(DIST);
for (const path of files) {
  const name = Buffer.from(relative(DIST, path).split(sep).join('/'));
  const data = readFileSync(path);
  const compressed = deflateRawSync(data, { level: 9 });
  const checksum = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); // local file header signature
  local.writeUInt16LE(20, 4); // version needed to extract: 2.0
  local.writeUInt16LE(8, 8); // compression: deflate
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  records.push(local, name, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); // central directory header signature
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed to extract
  central.writeUInt16LE(8, 10); // compression: deflate
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42); // where this file's local header starts
  directory.push(central, name);

  offset += local.length + name.length + compressed.length;
}

const directorySize = directory.reduce((size, part) => size + part.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directorySize, 12);
end.writeUInt32LE(offset, 16);

const out = `noodle-${manifest.version}.zip`;
writeFileSync(out, Buffer.concat([...records, ...directory, end]));
console.log(`\n✓ ${out} is ready to upload to the Chrome Web Store (${files.length} files).\n`);
