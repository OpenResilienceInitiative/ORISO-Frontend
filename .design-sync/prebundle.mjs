// Pre-compiles .design-sync/ds-entry.ts into plain JS for the design-sync converter.
//
// Why this exists: lib/bundle.mjs runs esbuild with a fixed option set — no
// .scss loader, no extra resolveExtensions — and the skill marks it as
// app-contract surface that must never be forked. ORISO-Frontend's components
// import SCSS directly (`import './agencyLanguages.styles'`, extensionless, the
// CRA/webpack convention that .storybook/main.ts mirrors via resolve.extensions)
// and use the CRA dual-export SVG idiom (`import { ReactComponent as Icon }`).
// So the converter's bundler cannot read this source — 183 esbuild errors.
//
// The documented way out is cfg.buildCmd + cfg.entry: compile the entry
// ourselves with exactly the loaders .storybook/main.ts uses, then hand the
// converter finished JS. Everything from node_modules stays external
// (`packages: 'external'`), so the converter still does its own dependency
// resolution, its react/react-dom/react-is shims still bind to window.React,
// and its metafile still reflects the real inlined set.
//
// Run: node .design-sync/prebundle.mjs
import { build } from '../.ds-sync/node_modules/esbuild/lib/main.js';
import * as sass from 'sass';
import { transform as svgrTransform } from '@svgr/core';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.cwd();
const SRC = join(REPO, 'src');
const NODE_MODULES = join(REPO, 'node_modules');
const OUT = join(REPO, '.design-sync/.cache/ds-entry.bundle.js');
const SETTINGS = join(SRC, 'resources/styles/settings.scss').replace(/\\/g, '/');

mkdirSync(dirname(OUT), { recursive: true });

// Mirrors .storybook/main.ts: settings.scss prepended to every sheet, src +
// node_modules on the load path, and webpack's `~pkg` prefix stripped (dart-sass
// has no such notion).
const scssPlugin = {
	name: 'oriso-scss',
	setup(b) {
		b.onLoad({ filter: /\.(scss|sass)$/ }, (args) => {
			const isIndented = args.path.endsWith('.sass');
			const result = sass.compileString(
				`@import "${SETTINGS}"; ` + readFileSync(args.path, 'utf8'),
				{
					syntax: isIndented ? 'indented' : 'scss',
					loadPaths: [dirname(args.path), SRC, NODE_MODULES],
					importers: [
						{
							findFileUrl(url) {
								if (!url.startsWith('~')) return null;
								return pathToFileURL(resolve(NODE_MODULES, url.slice(1)));
							},
						},
					],
					quietDeps: true,
					silenceDeprecations: ['import', 'global-builtin', 'legacy-js-api'],
				},
			);
			return { contents: result.css, loader: 'css', resolveDir: dirname(args.path) };
		});
	},
};

// CRA's @svgr/webpack dual export: default is the asset URL, ReactComponent is
// the React component. 116 files in src/ rely on the named half.
// SCSS reaches SVGs too (`background: url(.../arrow-down.svg)`), and a CSS
// url-token cannot consume a JSX module — so only JS-side imports are claimed
// here; CSS-side ones fall through to the '.svg': 'dataurl' loader below.
const svgPlugin = {
	name: 'oriso-svg-dual',
	setup(b) {
		b.onResolve({ filter: /\.svg$/ }, async (args) => {
			if (args.kind === 'url-token' || args.pluginData === 'svg-dual') return null;
			const r = await b.resolve(args.path, {
				resolveDir: args.resolveDir,
				kind: args.kind,
				pluginData: 'svg-dual',
			});
			if (r.errors.length) return r;
			return { path: r.path, namespace: 'svg-dual' };
		});
		b.onLoad({ filter: /.*/, namespace: 'svg-dual' }, async (args) => {
			const raw = readFileSync(args.path, 'utf8');
			const url = `data:image/svg+xml;base64,${Buffer.from(raw).toString('base64')}`;
			const component = await svgrTransform(
				raw,
				{
					plugins: ['@svgr/plugin-jsx'],
					exportType: 'named',
					namedExport: 'ReactComponent',
					jsxRuntime: 'classic',
				},
				{ componentName: 'ReactComponent', filePath: args.path },
			);
			return {
				contents: `${component}\nexport default ${JSON.stringify(url)};\n`,
				loader: 'jsx',
				resolveDir: dirname(args.path),
			};
		});
	},
};

const result = await build({
	entryPoints: [join(REPO, '.design-sync/ds-entry.ts')],
	outfile: OUT,
	bundle: true,
	format: 'esm',
	platform: 'browser',
	target: 'es2020',
	// Bare imports stay as imports: the converter resolves and inlines them, and
	// its react shims only bind if `react` is still an unresolved specifier here.
	packages: 'external',
	// .storybook/main.ts: webpack resolved extensionless imports incl. .scss.
	resolveExtensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json', '.scss', '.css', '.sass'],
	plugins: [scssPlugin, svgPlugin],
	loader: {
		'.png': 'dataurl',
		'.jpg': 'dataurl',
		'.jpeg': 'dataurl',
		'.gif': 'dataurl',
		'.webp': 'dataurl',
		'.avif': 'dataurl',
		'.ico': 'dataurl',
		'.svg': 'dataurl',
		'.woff': 'dataurl',
		'.woff2': 'dataurl',
		'.ttf': 'dataurl',
		'.mp3': 'dataurl',
		'.wav': 'dataurl',
	},
	// CRA components read process.env.REACT_APP_*; keep them from crashing.
	define: { 'process.env': '{}', 'process.env.NODE_ENV': '"development"' },
	// The 12 MB upload cap leaves no headroom; the converter's own pass cannot
	// minify (bundle.mjs pins minify:false), so the app half is minified here.
	minify: true,
	logLevel: 'warning',
	logLimit: 40,
	metafile: true,
});

const externals = new Set();
for (const inp of Object.values(result.metafile.outputs)) {
	for (const i of inp.imports ?? []) if (i.external) externals.add(i.path);
}
console.log(`wrote .design-sync/.cache/ds-entry.bundle.js`);
console.log(`external packages left for the converter: ${externals.size}`);
console.log([...externals].sort().join(', '));
