// Generates .design-sync/ds-entry.ts — the bundle entry for design-sync.
//
// ORISO-Frontend is an application, not a published component library: there is
// no dist/ and no barrel. The converter needs ONE module whose exports become
// window.OrisoApp, because lib/story-imports.mjs rule 2 redirects every story
// import that resolves to an exported component's module onto that global.
// Two consequences drive the logic below:
//
//   1. Whatever a story pulls out of a component module alongside the component
//      (`import { Box, BoxTypes } from './Box'`) must ALSO be an export here, or
//      the shimmed module hands the preview an undefined binding.
//   2. `component:` in the story meta is NOT a reliable anchor — 23 of this
//      repo's 108 story modules omit it (composite/demo stories). So the
//      component modules are derived from the stories' relative IMPORTS, and a
//      module counts as a component when its file/dir name is PascalCase or
//      ends in `Component`. Helpers (messageStoryShell, sessionHelpers,
//      storybookDesignLinks) stay lowercase and bundle from source — which is
//      what story-imports rule 3 wants anyway.
//
// Run: node .design-sync/gen-entry.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative, join, basename } from 'node:path';
import { titleParts } from '../.ds-sync/lib/common.mjs';

const REPO = process.cwd();

// The uploaded `_ds_bundle.js` is capped at 12 MB, and the FULL story roster
// bundles to 19.7 MB — ~11.5 MB of that is node_modules, so no amount of
// minification alone fits. These modules are excluded because their import
// closure drags in a heavy runtime dependency that nothing else needs:
//
//   app/Routing, app/RouterConfig ........ 5.3 / 5.2 MB — the whole app graph
//   Registration, MessageItemComponent,
//   EncryptionSettings, Header,
//   GroupCallWidget, KeyBackupRecoveryPrompt ... matrix-js-sdk (+crypto-wasm, widget-api) 2.5 MB
//   messageSubmitInterfaceComponent ...... draft-js, tiptap/prosemirror, emoji-picker
//   EmojiPickerPopup ..................... emoji-picker-react 0.7 MB
//   SessionListItemComponent ............. draft-js
//
// Owner decision 2026-08-18: take the entry diet rather than refactor the
// import graph first. lottie-react stays — `button/Button` already reaches it
// (Button -> Overlay for one constant -> the globalState barrel), so dropping
// it would mean dropping the atoms.
const HEAVY_EXCLUDE = [
	'src/components/app/Routing',
	'src/components/app/RouterConfig',
	'src/components/registration/Registration',
	'src/components/message/MessageItemComponent',
	'src/components/profile/EncryptionSettings/index',
	'src/components/header/Header',
	'src/components/call/GroupCallWidget',
	'src/components/E2EEncryptionSupportBanner/KeyBackupRecoveryPrompt',
	'src/components/messageSubmitInterface/messageSubmitInterfaceComponent',
	'src/components/messageSubmitInterface/inputField/EmojiPickerPopup',
	'src/components/sessionsListItem/SessionListItemComponent',
];
const isExcluded = (abs) => {
	const rel = relative(REPO, abs).replace(/\.[cm]?[jt]sx?$/, '');
	return HEAVY_EXCLUDE.includes(rel);
};
const IDX = join(REPO, '.design-sync/sb-reference/index.json');
const OUT = join(REPO, '.design-sync/ds-entry.ts');
const EXT = ['.tsx', '.ts', '.jsx', '.js'];

const resolveModule = (spec, fromDir) => {
	const base = resolve(fromDir, spec);
	for (const e of EXT) if (existsSync(base + e)) return base + e;
	for (const e of EXT) if (existsSync(join(base, 'index' + e))) return join(base, 'index' + e);
	return null;
};

// An import clause never contains a quote — that bound is what stops the lazy
// match from spanning statements and mis-attributing @storybook/react's Meta to
// the next relative import.
const IMPORT_RE = /import\s+(type\s+)?([^'"]*?)\s*from\s+['"]([^'"]+)['"]/g;

const parseImports = (src) => {
	const out = [];
	for (const m of src.matchAll(IMPORT_RE)) {
		const [, isType, clause, spec] = m;
		if (isType) continue;
		const named = [];
		const braces = clause.match(/\{([\s\S]*?)\}/);
		if (braces) {
			for (const p of braces[1].split(',').map((s) => s.trim()).filter(Boolean)) {
				if (/^type\s/.test(p)) continue;
				const [orig] = p.split(/\s+as\s+/).map((s) => s.trim());
				if (orig) named.push(orig);
			}
		}
		const def = clause.replace(/\{[\s\S]*?\}/, '').replace(/,/g, ' ').trim();
		out.push({ spec, named, def: def && !def.startsWith('*') ? def : null });
	}
	return out;
};

const inSrc = (abs) => abs.startsWith(join(REPO, 'src') + '/') && !/\.stor(y|ies)\./.test(abs);

// PascalCase file, or `<Dir>/index.tsx` with a PascalCase dir, or *Component.
// `named` is the fallback for the `import { Card } from './'` idiom, where the
// directory is lowercase and only the binding reveals it's a component.
const looksLikeComponentModule = (abs, named = []) => {
	if (!inSrc(abs)) return false;
	const file = basename(abs).replace(/\.[cm]?[jt]sx?$/, '');
	const dir = basename(dirname(abs));
	const name = file === 'index' ? dir : file;
	if (/^[A-Z]/.test(name) || /Component$/.test(name)) return true;
	return file === 'index' && named.some((n) => /^[A-Z][a-z]/.test(n));
};

const idx = JSON.parse(readFileSync(IDX, 'utf8'));
const entries = Object.values(idx.entries || {});
const byTitle = new Map();
for (const e of entries) if (!byTitle.has(e.title)) byTitle.set(e.title, e.importPath);

const modules = new Map(); // absFile -> {named:Set, defaults:Set}
const titleModules = new Map(); // title -> [absFile]
const bare = []; // titles that reach no component module at all
const excludedTitles = new Set(); // titles rendering a HEAVY_EXCLUDE module

// Walk out from each story file through relative imports. Story scaffolding
// (groupCallHarness, messageStoryShell, composerStoryDecorator) is lowercase, so
// it bundles from source per story-imports rule 3 — but the real components it
// pulls in recurse through rule 2 and must be on the global, so the traversal
// has to see past one hop. Depth 3 covers every harness in this repo.
const MAX_DEPTH = 3;

for (const [title, importPath] of byTitle) {
	const storyFile = resolve(REPO, importPath);
	if (!existsSync(storyFile)) continue;
	const hits = [];
	const seen = new Set([storyFile]);
	let frontier = [storyFile];
	for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
		const next = [];
		for (const file of frontier) {
			for (const imp of parseImports(readFileSync(file, 'utf8'))) {
				if (!imp.spec.startsWith('.')) continue;
				const abs = resolveModule(imp.spec, dirname(file));
				if (!abs || !inSrc(abs)) continue;
				if (isExcluded(abs)) {
					// Only a DIRECT import (depth 0) means the story actually renders
					// the excluded component — then mapping its title to whatever
					// other module it happens to touch would ship a preview of the
					// wrong component, so the whole title goes. A deeper hit is just
					// helper plumbing and must not cost us the title.
					if (depth === 0) excludedTitles.add(title);
					continue;
				}
				if (looksLikeComponentModule(abs, imp.named)) {
					hits.push(abs);
					const rec = modules.get(abs) || { named: new Set(), defaults: new Set() };
					imp.named.forEach((n) => rec.named.add(n));
					if (imp.def) rec.defaults.add(imp.def);
					modules.set(abs, rec);
					continue; // component modules ship whole; no need to walk inside
				}
				if (!seen.has(abs)) {
					seen.add(abs);
					next.push(abs);
				}
			}
		}
		frontier = next;
	}
	if (hits.length) titleModules.set(title, [...new Set(hits)]);
	else bare.push(title);
}

// Same exported name from two modules: first wins, the loser is reported so the
// drop is a decision on the record rather than a silent hole in the global.
const owner = new Map();
const collisions = [];
for (const [abs, rec] of [...modules].sort((a, b) => a[0].localeCompare(b[0]))) {
	for (const n of [...rec.named, ...rec.defaults]) {
		if (owner.has(n) && owner.get(n) !== abs) collisions.push([n, owner.get(n), abs]);
		else owner.set(n, abs);
	}
}

const lines = [
	'// GENERATED by .design-sync/gen-entry.mjs — do not edit by hand.',
	'// Bundle entry for design-sync: every component module the Storybook stories',
	'// import, plus the constants/enums they destructure alongside it.',
	'',
	'// The preview provider chain (cfg.provider). It has to ride in the bundle',
	'// because cfg.provider only accepts bundle EXPORTS, and it has to come',
	'// through this entry because only the prebundle can compile its SCSS imports.',
	"export { DesignSyncProviders } from './preview-providers';",
	'',
];
for (const [abs, rec] of [...modules].sort((a, b) => a[0].localeCompare(b[0]))) {
	const rel = './' + relative(join(REPO, '.design-sync'), abs).replace(/\.(tsx?|jsx?)$/, '');
	const named = [...rec.named].filter((n) => owner.get(n) === abs).sort();
	const defs = [...rec.defaults].filter((n) => owner.get(n) === abs).sort();
	if (named.length) lines.push(`export { ${named.join(', ')} } from '${rel}';`);
	for (const d of defs) lines.push(`export { default as ${d} } from '${rel}';`);
}
writeFileSync(OUT, lines.join('\n') + '\n');

// ── componentSrcMap: what makes the converter SEE these as components.
// `resolvePackage` derives its component list from PascalCase value exports in
// the .d.ts tree (lib/source-kit.mjs) — this repo ships no .d.ts, so that scan
// returned 0 and every storybook title was dropped as [TITLE_UNMAPPED].
// cfg.componentSrcMap is the documented override: it both ADDS the name and
// pins its source file for docs/prop enrichment. The keys must be exactly the
// names titleParts() derives, so we call the converter's own function.
const cfgPath = join(REPO, '.design-sync/config.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const srcMap = {};
const nameClashes = [];
const orphanTitles = [];

// Only the human's renames feed the classification. Reading back our OWN
// auto-generated nulls made every excluded title vanish from the input on the
// next run, which then wrote an empty titleMap — the set oscillated between
// runs instead of converging.
const manualRenames = Object.fromEntries(
	Object.entries(cfg.titleMap ?? {}).filter(([, v]) => v !== null),
);

for (const [title, importPath] of byTitle) {
	const { name } = titleParts(title, manualRenames, null);
	const mods = titleModules.get(title);
	if (excludedTitles.has(title) || !mods?.length) {
		orphanTitles.push([title, name]);
		continue;
	}
	// Prefer the module whose file (or dir, for index files) matches the name.
	const pick =
		mods.find((m) => {
			const f = basename(m).replace(/\.[cm]?[jt]sx?$/, '');
			return (f === 'index' ? basename(dirname(m)) : f).toLowerCase() === name.toLowerCase();
		}) ?? mods[0];
	if (srcMap[name] && srcMap[name] !== relative(REPO, pick)) nameClashes.push([name, title]);
	srcMap[name] = relative(REPO, pick);
}

// Excluded titles are pinned to null so titleParts() drops them at source,
// instead of resurfacing every build as [TITLE_UNMAPPED] noise.
cfg.titleMap = { ...manualRenames, ...Object.fromEntries(orphanTitles.map(([, n]) => [n, null])) };
cfg.componentSrcMap = { ...srcMap, ...Object.fromEntries(Object.entries(cfg.componentSrcMap ?? {}).filter(([, v]) => v === null)) };
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

// ── index.d.ts: what makes the converter SEE these as components.
// The storybook adapter matches story titles against `exportedNames()`, which
// reads the package's .d.ts tree (lib/dts.mjs) — NOT componentSrcMap. This repo
// ships no declarations, so that set was empty and all 95 titles were dropped as
// [TITLE_UNMAPPED]. The file has to sit at the REPO ROOT: findTypesRoot() may
// report a types/ dir, but projectFor() (lib/dts.mjs:90) opens
// `<pkgDir>/<pkgJson.types ?? 'index.d.ts'>` — with no `types` field that is
// <repo>/index.d.ts, and a types/index.d.ts is simply never read. Keeping it at
// the root also avoids adding a tooling-only `types` field to package.json.
//
// Each entry is `typeof import('<source>').<Export>` rather than a
// ComponentType<any> stub: ts-morph resolves it through the real .tsx, so the
// per-component <Name>.d.ts the design agent codes against carries the actual
// props instead of `any`.
const typeLines = [
	'// GENERATED by .design-sync/gen-entry.mjs — do not edit by hand.',
	'// Declaration surface for design-sync component discovery.',
	"import type { ComponentType } from 'react';",
	'',
];
let realTyped = 0;
for (const [name, relSrc] of Object.entries(srcMap)) {
	const abs = join(REPO, relSrc);
	const spec = './' + relative(REPO, abs).replace(/\.(tsx?|jsx?)$/, '');
	if (modules.get(abs)?.named.has(name)) {
		typeLines.push(`export declare const ${name}: typeof import('${spec}').${name};`);
		realTyped++;
	} else if (modules.get(abs)?.defaults.has(name)) {
		typeLines.push(`export declare const ${name}: typeof import('${spec}').default;`);
		realTyped++;
	} else {
		// Composite/demo stories: the title has no single matching source export.
		typeLines.push(`export declare const ${name}: ComponentType<any>;`);
	}
}
writeFileSync(join(REPO, 'index.d.ts'), typeLines.join('\n') + '\n');

const exportCount = [...owner.keys()].length;
console.log(`index.d.ts: ${Object.keys(srcMap).length} declarations (${realTyped} with real prop types)`);
console.log(`component modules: ${modules.size}   exports: ${exportCount}`);
console.log(`titles reaching a component module: ${titleModules.size}/${byTitle.size}`);
console.log(`componentSrcMap entries written to config.json: ${Object.keys(srcMap).length}`);
if (orphanTitles.length) {
	console.log('\nTITLES WITH NO COMPONENT MODULE LEFT (excluded or composite):');
	for (const [t, n] of orphanTitles) console.log(`  ${n}  <- ${t}`);
}
if (nameClashes.length) {
	console.log('\nNAME CLASHES (two titles derive the same component name):');
	for (const [n, t] of nameClashes) console.log(`  ${n}  <- ${t}`);
}
if (bare.length) {
	console.log('\nNO COMPONENT MODULE (composite/demo stories — need titleMap or an owned preview):');
	for (const t of bare) console.log(`  ${t}  <- ${byTitle.get(t)}`);
}
if (collisions.length) {
	console.log(`\nEXPORT COLLISIONS (${collisions.length}) — first module wins:`);
	for (const [n, a, b] of collisions) {
		console.log(`  ${n}: keeps ${relative(REPO, a)} / drops ${relative(REPO, b)}`);
	}
}
console.log(`\nwrote ${relative(REPO, OUT)}`);
