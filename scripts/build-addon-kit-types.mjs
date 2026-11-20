// Builds the types-only package `@oriso/web-kit` from src/addons/kit/types.ts (ADR-034).
// The runtime comes from the host on globalThis.__ORISO_ADDON_SHARED__.kit.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src/addons/kit/types.ts');
const out = join(root, 'build/addon-kit/web-kit');
const version = readFileSync(
	join(root, 'src/addons/kit/index.tsx'),
	'utf8'
).match(/WEB_KIT_VERSION = '([^']+)'/)[1];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
execFileSync(
	'npx',
	[
		'tsc',
		source,
		'--declaration',
		'--emitDeclarationOnly',
		'--skipLibCheck',
		'--jsx',
		'react-jsx',
		'--outDir',
		out
	],
	{ cwd: root, stdio: 'inherit' }
);

const kitBlock = readFileSync(source, 'utf8').match(
	/export interface WebKit \{([\s\S]*?)\n\}/
)[1];
const members = [...kitBlock.matchAll(/^\t(\w+):/gm)].map((match) => match[1]);
writeFileSync(
	join(out, 'index.d.ts'),
	[
		"export * from './types';",
		"import type { WebKit } from './types';",
		...members.map(
			(name) => `export declare const ${name}: WebKit['${name}'];`
		),
		''
	].join('\n')
);
writeFileSync(
	join(out, 'package.json'),
	`${JSON.stringify(
		{
			name: '@oriso/web-kit',
			version,
			description:
				'Types for the components the ORISO web app shares with add-ons (ADR-034).',
			license: 'AGPL-3.0',
			types: 'index.d.ts',
			files: ['*.d.ts'],
			peerDependencies: { '@types/react': '>=18' }
		},
		null,
		'\t'
	)}\n`
);
console.log(`@oriso/web-kit ${version}: ${members.join(', ')}`);
