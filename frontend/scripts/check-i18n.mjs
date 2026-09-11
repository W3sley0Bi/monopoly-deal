/**
 * Fails when a language is missing keys the English catalogue has, or carries
 * keys English does not. A missing string is invisible in the UI — it silently
 * falls back to English — so the only way to keep three languages honest is to
 * compare them mechanically.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/i18n/', import.meta.url).pathname;
const areas = readdirSync(join(root, 'en')).filter(f => f.endsWith('.ts') && f !== 'index.ts');
const langs = readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'en')
    .map(d => d.name);

/** Every quoted key in a catalogue file, in order. */
function keysOf(file) {
    const src = readFileSync(file, 'utf8');
    const body = src.slice(src.indexOf('= {') + 1);
    return new Set([...body.matchAll(/^\s*'([^']+)':/gm)].map(m => m[1]));
}

let failed = false;
for (const area of areas) {
    const en = keysOf(join(root, 'en', area));
    for (const lang of langs) {
        const theirs = keysOf(join(root, lang, area));
        const missing = [...en].filter(k => !theirs.has(k));
        const extra = [...theirs].filter(k => !en.has(k));
        if (missing.length || extra.length) {
            failed = true;
            console.error(`${lang}/${area}:`);
            if (missing.length) console.error(`  missing ${missing.length}: ${missing.join(', ')}`);
            if (extra.length) console.error(`  unknown ${extra.length}: ${extra.join(', ')}`);
        }
    }
}

const total = areas.reduce((n, a) => n + keysOf(join(root, 'en', a)).size, 0);
if (failed) {
    console.error(`\ni18n check failed (${total} English keys, languages: ${langs.join(', ')})`);
    process.exit(1);
}
console.log(`i18n ok — ${total} keys × ${langs.length + 1} languages (en, ${langs.join(', ')})`);
