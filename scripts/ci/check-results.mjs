import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkResults(needs) {
    for (const job of ['changes', 'repository']) {
        if (needs[job]?.result !== 'success') throw new Error(`${job} must succeed`);
    }
    for (const job of ['workspace', 'bom', 'cad', 'previews', 'booklets', 'recovery']) {
        const selected = needs.changes.outputs[job];
        if (!['true', 'false'].includes(selected)) throw new Error(`Missing or invalid ${job} selection`);
        const expected = selected === 'true' ? 'success' : 'skipped';
        if (needs[job]?.result !== expected) throw new Error(`${job}: expected ${expected}, got ${needs[job]?.result}`);
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    checkResults(JSON.parse(process.env.CI_NEEDS));
    console.log('All selected CI jobs passed; every skip was confirmed by change detection.');
}
