const path = require('path');

/**
 * Static serving for the built frontend, extracted from server.js so the
 * routing rules are testable (staticServing.test.js).
 *
 * Order matters:
 *  1. config.js — runtime configuration, never cached.
 *  2. /static — content-hashed build output. Served with day-long caching,
 *     and a miss is a HARD 404 (see below), never the SPA shell.
 *  3. Extension routes — root-level assets (favicon, logos, fonts).
 *  4. Root serve-static with the SPA shell as index.
 *
 * The SPA fallback (registerSpaFallback) is registered separately, AFTER the
 * API proxy middlewares, exactly as before the extraction.
 */
const registerBuildAssetRoutes = async (app, buildPath) => {
	const serveStatic = (await import('serve-static')).default;

	app.get(
		'/config.js',
		serveStatic(buildPath, {
			maxAge: 0,
			setHeaders: (res) => {
				res.setHeader(
					'Cache-Control',
					'no-store, no-cache, must-revalidate'
				);
			}
		})
	);

	app.use(
		'/static',
		serveStatic(path.join(buildPath, 'static'), { maxAge: '1d' })
	);
	// A miss under /static MUST be a hard 404. Everything here is named by
	// content hash, so "not found" only happens when the deployed build and
	// the client's chunk map disagree (rolling update race, stale shell).
	// Falling through to the SPA shell — the pre-fix behaviour — put HTML
	// under the .js URL with the shell's own ETag; the browser then
	// revalidated it 304 forever, import() kept failing, and the login
	// route or the stage composition stayed broken until the next deploy.
	// A 404 is not cached: one reload heals the session.
	app.use('/static', (req, res) => {
		res.status(404).type('txt').send('Not found');
	});

	app.get(
		/\.(?:css|js|jpe?g|png|gif|ico|cur|heic|webp|tiff?|mp[34eg]|a(?:ac|vi)|o(?:gg|gv)|flv|wmv)$/,
		serveStatic(buildPath, { maxAge: '1d' })
	);
	app.get(
		/.(?:svgz?|ttf|ttc|otf|eot|woff2?)$/,
		serveStatic(buildPath, { maxAge: '1d' })
	);
	app.use(serveStatic(buildPath, { index: 'beratung-hilfe.html' }));
};

const registerSpaFallback = (app, buildPath) => {
	app.get('*', (req, res) => {
		res.sendFile(path.join(buildPath, 'beratung-hilfe.html'));
	});
};

module.exports = { registerBuildAssetRoutes, registerSpaFallback };
