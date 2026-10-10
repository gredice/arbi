import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { PROTOCOL_VERSION } from '@arbi/protocol';
const hash = createHash('sha256');
for (const file of readdirSync('src', { recursive: true }).filter((f) => f.endsWith('.ts')).sort()) {
  hash.update(file).update(readFileSync(`src/${file}`));
}
for (const file of ['package.json', 'tsconfig.json', 'tsconfig.build.json', 'scripts/build-identity.mjs', 'deploy/arbi-edge-controller.service']) {
  hash.update(file).update(readFileSync(file));
}
hash.update(readFileSync('../../pnpm-lock.yaml'));
for (const file of ['message', 'configuration', 'audit-event']) hash.update(readFileSync(`../../packages/arbi-protocol/schema/${file}.schema.json`));
for (const file of readdirSync('../../packages/arbi-protocol/dist').filter((f) => f.endsWith('.js')).sort()) {
  hash.update(`protocol/${file}`).update(readFileSync(`../../packages/arbi-protocol/dist/${file}`));
}
hash.update(readFileSync('../../packages/arbi-traffic/package.json'));
for (const file of readdirSync('../../packages/arbi-traffic/dist').filter((f) => f.endsWith('.js')).sort()) {
  hash.update(`traffic/${file}`).update(readFileSync(`../../packages/arbi-traffic/dist/${file}`));
}
hash.update(readFileSync('fixtures/commissioning.json'));
for (const dependency of ['arbi-audit', 'arbi-simulation-core', 'arbi-gredice']) {
  hash.update(readFileSync(`../../packages/${dependency}/package.json`));
  for (const file of readdirSync(`../../packages/${dependency}/dist`).filter((f) => f.endsWith('.js')).sort()) {
    hash.update(`${dependency}/${file}`).update(readFileSync(`../../packages/${dependency}/dist/${file}`));
  }
}
writeFileSync('dist/build-identity.json', JSON.stringify({ version: '0.1.0', protocol: PROTOCOL_VERSION, sourceDigest: hash.digest('hex') }) + '\n');
