import {
	mkdtempSync,
	mkdirSync,
	cpSync,
	writeFileSync,
	readFileSync,
	rmSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const repository = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../..'
);
const journal = (record) => {
	if (process.env.PRODUCT_DEV_EVENTS_FILE)
		appendFileSync(
			process.env.PRODUCT_DEV_EVENTS_FILE,
			JSON.stringify({ atUTC: new Date().toISOString(), ...record }) +
				'\n'
		);
};
export function fixture() {
	const cache = path.join(repository, '.tmp-proof');
	mkdirSync(cache, { recursive: true });
	const root = mkdtempSync(path.join(cache, 'product-dev-'));
	for (const directory of ['src/pages', 'src/extensions/pages', 'public'])
		mkdirSync(path.join(root, directory), { recursive: true });
	writeFileSync(
		path.join(root, 'package.json'),
		JSON.stringify({ name: 'controlled-real-dev-fixture' })
	);
	for (const page of ['app', 'under-construction'])
		cpSync(
			path.join(repository, `src/pages/${page}.html`),
			path.join(root, `src/pages/${page}.html`)
		);
	cpSync(path.join(repository, 'proxy'), path.join(root, 'proxy'), {
		recursive: true,
		filter: (source) => !source.split(path.sep).includes('node_modules')
	});
	// The actual canonical shim has a relative package reference. Keep its real
	// bytes and provide only this worktree's exact installed react-dom package.
	cpSync(
		path.join(repository, 'src/react-dom-shim.ts'),
		path.join(root, 'src/react-dom-shim.ts')
	);
	cpSync(
		path.join(repository, 'node_modules/react-dom'),
		path.join(root, 'node_modules/react-dom'),
		{ recursive: true }
	);
	const counter = path.join(root, 'src/Counter.tsx');
	writeFileSync(counter, counterSource('Before'));
	writeFileSync(
		path.join(root, 'src/initApp.tsx'),
		`import {createRoot} from 'react-dom/client';import Counter from './Counter';if(!globalThis.__CONFIG_SEEN__)throw new Error('config did not execute before module');createRoot(document.getElementById('appRoot')).render(<Counter/>);`
	);
	writeFileSync(
		path.join(root, 'src/initError.ts'),
		'globalThis.__ERROR_ENTRY__=true;globalThis.__CSRF_HEADER__=process.env.REACT_APP_CSRF_WHITELIST_HEADER_PROPERTY;'
	);
	for (const asset of ['favicon.ico', 'logo192.png', 'logo512.png'])
		cpSync(
			path.join(repository, 'public', asset),
			path.join(root, 'public', asset)
		);
	writeFileSync(
		path.join(root, 'public/config.js'),
		'globalThis.__CONFIG_SEEN__=true;'
	);
	writeFileSync(
		path.join(root, 'public/probe.txt'),
		'controlled public asset'
	);
	writeFileSync(
		path.join(root, '.env'),
		'PRIVATE_DEV_TRAP=DO_NOT_SERVE_PRIVATE_BYTES\n'
	);
	return {
		root,
		counter,
		cleanup() {
			if (process.env.PRODUCT_DEV_ARTIFACT_ROOT) {
				const dest = path.join(
					process.env.PRODUCT_DEV_ARTIFACT_ROOT,
					path.basename(root)
				);
				cpSync(root, dest, {
					recursive: true,
					filter: (source) =>
						!source
							.slice(root.length)
							.split(path.sep)
							.some((part) =>
								[
									'node_modules',
									'.certificates',
									'.vite'
								].includes(part)
							) && !/\.(pem|key|crt)$/.test(source)
				});
			}
			rmSync(root, { recursive: true, force: true });
		}
	};
}
export const counterSource = (caption) =>
	`import {useState} from 'react';export default function Counter(){const [count,setCount]=useState(0);return <button onClick={()=>setCount(count+1)}>${caption} {count}</button>}`;
export async function startFixture(value, environment = {}, options = {}) {
	const module = new URL('../../config/vite-product-dev.mjs', import.meta.url)
		.href;
	const code = `let owner;try{const {createProductDevServer}=await import(${JSON.stringify(module)});owner=await createProductDevServer(${JSON.stringify({ root: value.root, host: '127.0.0.1', port: 0, ...options })});process.send({ready:true,url:owner.url,pid:process.pid});process.on('message',async message=>{if(message==='close'){try{await owner.close();await owner.close();process.send({closed:true});process.exit(0)}catch(error){console.error(error);process.exit(1)}}});}catch(error){console.error(error);process.send({error:error.message});process.exitCode=1;}`;
	const allowed = ['HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'PATH'];
	const env = Object.fromEntries(
		allowed
			.filter((key) => process.env[key] !== undefined)
			.map((key) => [key, process.env[key]])
	);
	Object.assign(env, { BROWSER: 'none', ...environment });
	const child = spawn(process.execPath, ['--input-type=module', '-e', code], {
		cwd: repository,
		env,
		stdio: ['ignore', 'pipe', 'pipe', 'ipc']
	});
	let output = '';
	child.stdout.on('data', (chunk) => {
		output += chunk;
	});
	child.stderr.on('data', (chunk) => {
		output += chunk;
	});
	journal({ event: 'spawn', pid: child.pid, root: value.root, options });
	const exited = new Promise((resolve) =>
		child.once('exit', (code, signal) => {
			journal({ event: 'exit', pid: child.pid, code, signal, output });
			resolve({ code, signal });
		})
	);
	const stop = async () => {
		if (child.exitCode !== null || child.signalCode !== null) return exited;
		child.send('close');
		let timer;
		try {
			return await Promise.race([
				exited,
				new Promise((_, reject) => {
					timer = setTimeout(
						() =>
							reject(
								new Error(
									'Owned dev fixture did not close within 10s'
								)
							),
						10000
					);
				})
			]);
		} catch (error) {
			child.kill('SIGTERM');
			await exited;
			throw error;
		} finally {
			clearTimeout(timer);
		}
	};
	try {
		const ready = await new Promise((resolve, reject) => {
			const timeout = setTimeout(
				() =>
					reject(
						new Error(
							'Owned dev fixture startup exceeded 15s\n' + output
						)
					),
				15000
			);
			child.once('message', (message) => {
				clearTimeout(timeout);
				if (message.error) reject(new Error(message.error));
				else resolve(message);
			});
			child.once('exit', () => {
				clearTimeout(timeout);
				reject(new Error('Dev fixture exited before ready\n' + output));
			});
		});
		return { ...ready, stop, output: () => output };
	} catch (error) {
		if (child.exitCode === null && child.signalCode === null)
			child.kill('SIGTERM');
		await exited;
		throw error;
	}
}
export async function certificateFiles(value) {
	const { resolveConfig } = await import('vite');
	const { default: basicSsl } = await import('@vitejs/plugin-basic-ssl');
	const config = await resolveConfig(
		{
			root: value.root,
			configFile: false,
			logLevel: 'silent',
			plugins: [
				basicSsl({ certDir: path.join(value.root, '.certificates') })
			],
			server: { https: {} }
		},
		'serve'
	);
	const key = path.join(value.root, 'fixture.key');
	const cert = path.join(value.root, 'fixture.crt');
	const keyMatch = String(config.server.https.key).match(
		/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/
	);
	const certMatch = String(config.server.https.cert).match(
		/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/
	);
	if (!keyMatch || !certMatch)
		throw new Error(
			'Controlled TLS fixture must contain a separate real private key and certificate'
		);
	writeFileSync(key, keyMatch[0]);
	writeFileSync(cert, certMatch[0]);
	return { key, cert, ca: readFileSync(cert) };
}
