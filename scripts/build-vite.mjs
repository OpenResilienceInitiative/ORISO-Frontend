import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createProductConfig } from '../config/vite-product-config.mjs';

process.env.NODE_ENV = 'production';
process.env.BABEL_ENV = 'production';
const require = createRequire(import.meta.url);
const config = await createProductConfig({ mode: 'production' });
const root = config.root;
const paths = require('../config/paths.js');
for (const entry of Object.values(paths.appEntryPoints)) {
	if (!statSync(entry).isFile())
		throw new Error(`Missing product entry: ${entry}`);
}
const types = spawnSync(
	process.execPath,
	[require.resolve('typescript/bin/tsc'), '--noEmit'],
	{ cwd: root, stdio: 'inherit' }
);
if (types.error) throw types.error;
if (types.status !== 0) process.exit(types.status ?? 1);
const { build } = await import('vite');
await build(config);

// The canonical dotenv loader may set BUILD_PATH inside this process. Validate
// the resolved output, rather than a separate npm shell's default directory.
const hosts = spawnSync(
	'bash',
	['scripts/validate-hardcoded-hosts.sh', config.build.outDir],
	{ cwd: root, stdio: 'inherit' }
);
if (hosts.error) throw hosts.error;
if (hosts.status !== 0) process.exit(hosts.status ?? 1);
