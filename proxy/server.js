const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand').expand;
dotenvExpand(dotenv.config());

app.disable('x-powered-by');

process.on('unhandledRejection', (err) => {
	console.error('Unhandled promise rejection in proxy server:', err);
});

const port = parseInt(process.env.PORT, 10) || 3000;
const host = process.env.HOST || '0.0.0.0';

const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = (relativePath) => path.resolve(appDirectory, relativePath);
const storagePath =
	process.env.STORAGE_PATH && resolveApp(process.env.STORAGE_PATH);

const createServer = async () => {
	if (port == null) {
		return;
	}

	if (storagePath) {
		await fs.promises
			.access(storagePath)
			.catch(() => fs.promises.mkdir(storagePath, { recursive: true }));
	}

	let buildPath = resolveApp('build');
	try {
		await fs.promises.access(buildPath);
	} catch {
		// Try fallback build directory next to proxy directory
		buildPath = resolveApp('../build');
		await fs.promises.access(buildPath);
	}

	app.use((await import('compression')).default());
	app.use(express.json());

	const { registerLivekitTokenRoutes } = require('./lib/livekitTokenRoutes');
	registerLivekitTokenRoutes(app);

	const {
		registerBuildAssetRoutes,
		registerSpaFallback
	} = require('./lib/staticServing');
	await registerBuildAssetRoutes(app, buildPath);

	const middlewareConfigs = require('./routes')(storagePath);
	middlewareConfigs.forEach(
		({ method, middleware: callback, path: route }) => {
			const middleware = [];

			if (route) {
				middleware.push(route);
			}
			middleware.push(callback);

			if (!method) {
				app.use(...middleware);
				return;
			}

			app[method.toLowerCase()](...middleware);
		}
	);

	registerSpaFallback(app, buildPath);

	return new Promise((resolve) => {
		app.listen(port, resolve);
	}).then(() => {
		['SIGINT', 'SIGTERM'].forEach(function (sig) {
			process.on(sig, function () {
				process.exit();
			});
		});

		if (process.env.CI !== 'true') {
			// Gracefully exit when stdin ends
			process.stdin.on('end', function () {
				process.exit();
			});
		}
	});
};

createServer()
	.then(() => {
		console.log('Starting the server...\n');
		console.log(`http://${host}:${port}`);
	})
	.catch((e) => {
		if (e && e.message) {
			console.log(e.message);
		}
		process.exit(1);
	});
