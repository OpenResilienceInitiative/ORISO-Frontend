const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand').expand;
dotenvExpand(dotenv.config());

app.disable('x-powered-by');

process.on('unhandledRejection', (err) => {
	throw err;
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

	// LiveKit Token Service Proxy
	app.get('/api/livekit/token', async (req, res) => {
		try {
			console.log('🔑 Proxying LiveKit token request:', req.query);
			const { roomName, identity } = req.query;
			
			if (!roomName || !identity) {
				return res.status(400).json({ error: 'roomName and identity are required' });
			}

			const livekitTokenServiceUrl = process.env.LIVEKIT_TOKEN_SERVICE_URL || 'http://livekit-token-service.caritas.svc.cluster.local:3010';
			const targetUrl = `${livekitTokenServiceUrl}/api/livekit/token?roomName=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`;
			
			console.log('📡 Fetching from:', targetUrl);
			
			const response = await fetch(targetUrl);
			const data = await response.json();
			
			console.log('✅ Token received, forwarding to client');
			res.json(data);
		} catch (error) {
			console.error('❌ LiveKit token proxy error:', error);
			res.status(500).json({ error: 'Failed to get LiveKit token', details: error.message });
		}
	});

	const serveStatic = await import('serve-static');
	app.get(
		/\.(?:css|js|jpe?g|png|gif|ico|cur|heic|webp|tiff?|mp[34eg]|a(?:ac|vi)|o(?:gg|gv)|flv|wmv)$/,
		serveStatic.default(buildPath, { maxAge: '1d' })
	);
	app.get(
		/.(?:svgz?|ttf|ttc|otf|eot|woff2?)$/,
		serveStatic.default(buildPath, { maxAge: '1d' })
	);
	app.use(serveStatic.default(buildPath, { index: 'beratung-hilfe.html' }));

	// LiveKit token service proxy
	app.post('/api/livekit/token', async (req, res) => {
		try {
			const response = await fetch('http://livekit-token-service.caritas.svc.cluster.local:3010/api/livekit/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(req.body)
			});
			const data = await response.json();
			res.json(data);
		} catch (error) {
			console.error('LiveKit token proxy error:', error);
			res.status(500).json({ error: 'Failed to generate token' });
		}
	});

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

	app.get('*', (req, res) => {
		res.sendFile(path.join(buildPath, 'beratung-hilfe.html'));
	});

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
