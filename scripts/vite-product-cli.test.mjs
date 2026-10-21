import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';

const repository = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..'
);
const launcher = path.join(repository, 'scripts/start-vite.mjs');
const options = { timeout: 30000 };
const deadline = async (promise, milliseconds, message) => {
	let timer;
	try {
		return await Promise.race([
			promise,
			new Promise((_, reject) => {
				timer = setTimeout(
					() => reject(new Error(message)),
					milliseconds
				);
			})
		]);
	} finally {
		clearTimeout(timer);
	}
};
const alive = (pid) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if (error.code === 'ESRCH') return false;
		throw error;
	}
};
const listen = async (port = 0) => {
	const server = net.createServer((socket) => socket.end());
	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, '127.0.0.1', resolve);
	});
	return server;
};
const close = (server) =>
	new Promise((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve()))
	);
const availablePort = async () => {
	const server = await listen();
	const port = server.address().port;
	await close(server);
	return port;
};
const portReleased = async (port) => {
	const probe = await listen(port);
	await close(probe);
};
const responds = (port) =>
	new Promise((resolve, reject) => {
		const request = http.request(
			{
				host: '127.0.0.1',
				port,
				path: '/config.js',
				method: 'HEAD'
			},
			(response) => {
				response.resume();
				response.once('end', () => resolve(response.statusCode));
			}
		);
		request.setTimeout(1000, () =>
			request.destroy(new Error('Local runtime config HEAD exceeded 1s'))
		);
		request.once('error', reject);
		request.end();
	});

const start = (t, name, port, environment = {}) => {
	const root =
		process.env.PRODUCT_CLI_ARTIFACTS_DIR ||
		path.join(
			process.env.VERIFICATION_ARTIFACTS_DIR ||
				path.join(repository, 'verification-artifacts'),
			'product-cli'
		);
	mkdirSync(root, { recursive: true });
	const artifacts = mkdtempSync(path.join(root, name + '-'));
	const env = Object.fromEntries(
		['HOME', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'PATH']
			.filter((key) => process.env[key] !== undefined)
			.map((key) => [key, process.env[key]])
	);
	Object.assign(env, {
		BROWSER: 'none',
		HOST: '127.0.0.1',
		PORT: String(port),
		CI: 'true',
		HTTPS: 'false',
		PUBLIC_URL: '/',
		STORAGE_PATH: path.join(artifacts, 'storage'),
		REACT_APP_DEV_REMOTE_API_URL: 'http://127.0.0.1:9',
		...environment
	});
	const child = spawn(process.execPath, [launcher], {
		cwd: repository,
		env,
		detached: true,
		stdio: ['pipe', 'pipe', 'pipe']
	});
	const observed = new Set([child.pid]);
	let output = '';
	const samplingErrors = [];
	const sample = () => {
		try {
			const rows = execFileSync('ps', ['-axo', 'pid=,ppid='], {
				encoding: 'utf8'
			})
				.trim()
				.split('\n')
				.map((row) => row.trim().split(/\s+/).map(Number));
			let previous;
			do {
				previous = observed.size;
				for (const [pid, parent] of rows)
					if (observed.has(parent)) observed.add(pid);
			} while (observed.size !== previous);
		} catch (error) {
			samplingErrors.push(error.message);
		}
	};
	const receipt = {
		name,
		pid: child.pid,
		argv: [process.execPath, launcher],
		cwd: repository,
		startedAtUTC: new Date().toISOString(),
		port,
		ci: env.CI,
		artifacts
	};
	const record = (extra = {}) => {
		Object.assign(receipt, extra);
		writeFileSync(
			path.join(artifacts, 'process.json'),
			JSON.stringify(
				{
					...receipt,
					observedPIDs: [...observed],
					samplingErrors
				},
				null,
				2
			) + '\n'
		);
	};
	record();
	sample();
	const sampler = setInterval(sample, 200);
	let readyResolve;
	const ready = new Promise((resolve) => {
		readyResolve = resolve;
	});
	const receive = (chunk) => {
		output += chunk;
		if (
			output.includes('Starting the development server...') &&
			output.includes(`http://127.0.0.1:${port}`)
		)
			readyResolve();
	};
	child.stdout.on('data', receive);
	child.stderr.on('data', receive);
	const exited = new Promise((resolve) => {
		child.once('error', (error) => {
			record({ spawnError: error.message });
			resolve({ code: null, signal: null, spawnError: error.message });
		});
		child.once('close', (code, signal) => {
			clearInterval(sampler);
			sample();
			writeFileSync(path.join(artifacts, 'stdout-stderr.log'), output);
			record({ endedAtUTC: new Date().toISOString(), code, signal });
			resolve({ code, signal });
		});
	});
	// Safety cleanup runs only after the test has made its natural-exit
	// assertions. A forced cleanup never satisfies those assertions.
	t.after(async () => {
		clearInterval(sampler);
		if (alive(-child.pid)) {
			record({ forcedSafetyCleanup: true, safetySignal: 'SIGTERM' });
			process.kill(-child.pid, 'SIGTERM');
			try {
				await deadline(
					exited,
					10000,
					'Owned CLI safety cleanup exceeded 10s'
				);
			} catch (error) {
				if (alive(-child.pid)) {
					record({
						forcedSafetyCleanup: true,
						safetySignal: 'SIGKILL'
					});
					process.kill(-child.pid, 'SIGKILL');
				}
				await exited;
				throw error;
			}
		}
		const residual = [...observed].filter(alive);
		record({ safetyCleanupComplete: true, residualPIDs: residual });
		assert.deepEqual(residual, []);
		assert.equal(alive(-child.pid), false);
	});
	return {
		artifacts,
		child,
		async ready() {
			await deadline(
				Promise.race([
					ready,
					exited.then((result) => {
						throw new Error(
							`Actual CLI exited before ready: ${JSON.stringify(result)}; see ${artifacts}`
						);
					})
				]),
				15000,
				`Actual CLI startup exceeded 15s; see ${artifacts}`
			);
			assert.equal(await responds(port), 200);
		},
		async naturalExit() {
			const result = await deadline(
				exited,
				10000,
				`Actual CLI did not exit naturally within 10s; see ${artifacts}`
			);
			assert.equal(result.spawnError, undefined);
			assert.equal(result.signal, null);
			assert.equal(Number.isInteger(result.code), true);
			assert.deepEqual(samplingErrors, []);
			const residual = [...observed].filter(alive);
			record({
				naturalExitResult: result,
				naturalExitResidualPIDs: residual
			});
			assert.deepEqual(residual, []);
			assert.equal(alive(-child.pid), false);
			return { ...result, output };
		}
	};
};

for (const signal of ['SIGINT', 'SIGTERM'])
	test(
		`real development CLI exits naturally on ${signal} and releases its port`,
		options,
		async (t) => {
			const port = await availablePort();
			const owner = start(t, signal.toLowerCase(), port, { CI: 'false' });
			await owner.ready();
			owner.child.kill(signal);
			assert.equal((await owner.naturalExit()).code, 0);
			await portReleased(port);
		}
	);

test(
	'real non-CI development CLI exits naturally on stdin EOF and releases its port',
	options,
	async (t) => {
		const port = await availablePort();
		const owner = start(t, 'stdin-eof', port, { CI: 'false' });
		await owner.ready();
		owner.child.stdin.end();
		assert.equal((await owner.naturalExit()).code, 0);
		await portReleased(port);
	}
);

test(
	'real development CLI rejects a busy port naturally without owned children',
	options,
	async (t) => {
		const occupied = await listen();
		t.after(() => (occupied.listening ? close(occupied) : undefined));
		const port = occupied.address().port;
		const owner = start(t, 'busy-port', port);
		const result = await owner.naturalExit();
		assert.equal(result.code, 1);
		assert.match(result.output, /EADDRINUSE|address already in use/);
		assert.equal(occupied.listening, true);
		await close(occupied);
		await portReleased(port);
	}
);

test(
	'real development CLI rejects invalid explicit TLS naturally and releases its port',
	options,
	async (t) => {
		const port = await availablePort();
		const certificateDirectory = path.join(
			process.env.PRODUCT_CLI_ARTIFACTS_DIR ||
				process.env.VERIFICATION_ARTIFACTS_DIR ||
				path.join(repository, 'verification-artifacts'),
			'product-cli-invalid-tls'
		);
		mkdirSync(certificateDirectory, { recursive: true });
		const cert = path.join(certificateDirectory, 'controlled.crt');
		const key = path.join(certificateDirectory, 'controlled.key');
		writeFileSync(cert, 'controlled invalid certificate');
		writeFileSync(key, 'controlled invalid private key');
		const owner = start(t, 'invalid-tls', port, {
			HTTPS: 'true',
			SSL_CRT_FILE: cert,
			SSL_KEY_FILE: key
		});
		const result = await owner.naturalExit();
		assert.equal(result.code, 1);
		assert.match(result.output, /certificate[\s\S]*is invalid/);
		assert.ok(result.output.includes(cert));
		await portReleased(port);
	}
);
