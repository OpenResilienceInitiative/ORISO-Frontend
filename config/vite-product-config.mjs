import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { productHtmlPlugin, productPages } from './vite-product-html.mjs';

const require = createRequire(import.meta.url);
const repository = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..'
);
const canonicalEnv = path.join(repository, 'config/env.js');
const canonicalPaths = path.join(repository, 'config/paths.js');

export function loadProductEnvironment({
	root = repository,
	mode = 'production'
} = {}) {
	root = realpathSync(root);
	if (!['production', 'development', 'test'].includes(mode))
		throw new Error(`Unsupported product environment: ${mode}`);
	let commit;
	try {
		commit = execFileSync(
			'git',
			['rev-parse', '--verify', 'HEAD^{commit}'],
			{ cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
		).trim();
		if (!/^[a-f0-9]{40}$/.test(commit))
			throw new Error('Invalid checkout SHA');
	} catch (error) {
		throw new Error('Product source root must be inside a Git checkout', {
			cause: error
		});
	}
	// Reuse the existing dotenv order, expansion, shell precedence and public
	// allowlist. Like the legacy build, this initializes the process environment.
	process.env.NODE_ENV = mode;
	const previousDirectory = process.cwd();
	let paths, raw;
	try {
		process.chdir(root);
		delete require.cache[require.resolve(canonicalPaths)];
		delete require.cache[require.resolve(canonicalEnv)];
		const getClientEnvironment = require(canonicalEnv);
		paths = require(canonicalPaths);
		raw = {
			...getClientEnvironment(paths.publicUrlOrPath.slice(0, -1)).raw,
			REACT_APP_BUILD_COMMIT: commit
		};
	} finally {
		process.chdir(previousDirectory);
	}
	const assetsInlineLimit = Number.parseInt(
		process.env.IMAGE_INLINE_SIZE_LIMIT || '10000',
		10
	);
	if (!Number.isFinite(assetsInlineLimit) || assetsInlineLimit < 0)
		throw new Error('IMAGE_INLINE_SIZE_LIMIT must be nonnegative');
	return {
		root,
		raw,
		paths,
		define: {
			'process': JSON.stringify({ env: raw }),
			'process.env': JSON.stringify(raw)
		},
		build: {
			sourcemap: process.env.GENERATE_SOURCEMAP !== 'false',
			assetsInlineLimit
		}
	};
}

export async function createProductConfig(options = {}) {
	const environment = loadProductEnvironment(options);
	const { paths } = environment;
	const [{ default: react }, { default: svgr }] = await Promise.all([
		import('@vitejs/plugin-react'),
		import('vite-plugin-svgr')
	]);
	const settings = [paths.appSrc, paths.appExtensions].map((directory) =>
		path.join(directory, 'resources/styles/settings.scss')
	);
	const settingsPrefix = settings
		.filter((file) => existsSync(file) && statSync(file).isFile())
		.map((file) => `@import ${JSON.stringify(file)};`)
		.join(' ');
	const browsers = require(path.join(repository, 'package.json')).browserslist
		?.production;
	return {
		configFile: false,
		root: paths.appPath,
		mode: options.mode || 'production',
		// Canonical env.js already loaded dotenv; Vite must not add VITE_* secrets.
		envDir: false,
		envPrefix: [],
		publicDir: paths.appPublic,
		base: paths.publicUrlOrPath,
		define: environment.define,
		plugins: [
			productHtmlPlugin(environment),
			react(),
			svgr({
				svgrOptions: {
					svgo: false,
					titleProp: true,
					ref: true,
					jsxRuntime: 'automatic'
				}
			}),
			{
				name: 'oriso-product-svg-url-and-component',
				enforce: 'pre',
				load(id) {
					const [file, query] = id.split('?');
					if (file.endsWith('.svg') && !query)
						return `export { default } from ${JSON.stringify(file + '?url')};\nexport { default as ReactComponent } from ${JSON.stringify(file + '?react')};`;
					return null;
				}
			}
		],
		resolve: {
			extensions: [
				...paths.moduleFileExtensions.map(
					(extension) => '.' + extension
				),
				'.css',
				'.sass'
			],
			alias: [
				{
					find: /^react-dom$/,
					replacement: path.join(paths.appSrc, 'react-dom-shim.ts')
				},
				{ find: /^src\//, replacement: paths.appSrc + '/' },
				{
					find: /^extensions\//,
					replacement: paths.appExtensions + '/'
				},
				{ find: 'react-native', replacement: 'react-native-web' }
			]
		},
		css: {
			postcss: {
				plugins: [
					require('postcss-flexbugs-fixes')(),
					require('postcss-preset-env')({
						autoprefixer: { flexbox: 'no-2009' },
						stage: 3,
						browsers
					}),
					require('postcss-normalize')()
				]
			},
			preprocessorOptions: {
				scss: {
					api: 'modern',
					additionalData: settingsPrefix,
					loadPaths: [
						paths.appSrc,
						path.join(repository, 'node_modules')
					],
					importers: [
						{
							findFileUrl(url) {
								return url.startsWith('~')
									? pathToFileURL(
											path.join(
												repository,
												'node_modules',
												url.slice(1)
											)
										)
									: null;
							}
						}
					]
				}
			}
		},
		build: {
			outDir: paths.appBuild,
			emptyOutDir: true,
			manifest: true,
			...environment.build,
			target: ['chrome111', 'firefox114', 'safari16.4'],
			rolldownOptions: {
				input: Object.fromEntries(
					productPages.map((name) => [
						name.replace(/\.html$/, ''),
						path.join(paths.appPath, name)
					])
				),
				output: {
					entryFileNames: 'static/js/[name]-[hash].js',
					chunkFileNames: 'static/js/[name]-[hash].js',
					assetFileNames: (asset) =>
						/\.css$/.test(asset.names?.[0] || asset.name || '')
							? 'static/css/[name]-[hash][extname]'
							: 'static/media/[name]-[hash][extname]'
				}
			}
		}
	};
}
