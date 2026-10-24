import { resolve } from 'node:path';
import { createServer } from 'vite';

/** Run repository TypeScript CLIs through the pinned public Vite SSR loader. */
const [entry, ...args] = process.argv.slice(2);
let server;
try {
	if (!entry) {
		throw new Error(
			'Usage: node scripts/run-vite-script.mjs <entry> [args...]'
		);
	}
	const filename = resolve(entry);
	process.argv = [process.execPath, filename, ...args];
	server = await createServer({
		configFile: false,
		envDir: false,
		root: process.cwd(),
		server: { middlewareMode: true, watch: null },
		ssr: { noExternal: ['@material/material-color-utilities'] }
	});
	await server.ssrLoadModule(filename);
} catch (error) {
	console.error(error);
	process.exitCode = 1;
} finally {
	await server?.close();
}
