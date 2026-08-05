import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import svgr from 'vite-plugin-svgr';

// PROOF/build-out config (SB10 + Vite). Original SB7/webpack config kept as main.ts.sb7.bak.
// Hardening (full preview shell) still pending.

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '../src');
const nodeModules = path.resolve(here, '../node_modules');
const settingsMain = path
	.resolve(srcDir, 'resources/styles/settings.scss')
	.replace(/\\/g, '/');

const config: StorybookConfig = {
	stories: [
		// Expose every migrated component story to Storybook MCP. The MCP only sees
		// stories included here, so keep real product surfaces (registration,
		// session list, composer-adjacent pieces) in the catalog instead of only
		// the first atomic proof batch.
		'../src/components/**/*.stories.@(ts|tsx)'
	],
	// SB7 served these (compound-web.css etc. referenced by preview-head.html)
	staticDirs: ['./static', '../public'],
	addons: [
		'@storybook/addon-mcp',
		'@storybook/addon-designs',
		'@storybook/addon-a11y'
	],
	framework: { name: '@storybook/react-vite', options: {} },
	async viteFinal(cfg) {
		return mergeConfig(cfg, {
			// `../public` is already a staticDir above, and Vite's default
			// publicDir points at that very same folder. builder-vite never turns
			// publicDir off, so the build copied public/ into storybook-static
			// twice at once: Storybook's staticDirs copy and Vite's own
			// copyPublicDir. Both create storybook-static/static, and node's
			// fs.cp mkdirs each directory non-recursively, so whichever loses the
			// race dies with `EEXIST ... mkdir './storybook-static/static'`.
			// Local builds usually won the race; the emulated linux/arm64 leg of
			// the Docker job is slow enough to lose it intermittently.
			// Disabling publicDir leaves staticDirs as the single copier, which
			// Storybook runs sequentially and therefore deterministically.
			publicDir: false,
			plugins: [
				// The virtual project-annotations module imports @storybook/react's
				// dist files by absolute /node_modules/... path. Vite doesn't map
				// bare `import React from 'react'` inside such files onto the
				// pre-bundled dep, so the raw CJS react/index.js gets served as ESM
				// and the preview boot dies ("does not provide an export named
				// 'default'"). Re-resolving those imports as if they came from
				// project source routes them through the optimizer again.
				{
					name: 'oriso-force-optimized-react',
					enforce: 'pre' as const,
					async resolveId(
						id: string,
						importer: string | undefined,
						options: any
					) {
						if (
							!importer ||
							!importer.includes('node_modules') ||
							importer.includes('.vite') ||
							![
								'react',
								'react-dom',
								'react-dom/client',
								'react/jsx-runtime',
								'react/jsx-dev-runtime'
							].includes(id)
						) {
							return null;
						}
						return this.resolve(id, path.join(srcDir, 'index.ts'), {
							...options,
							skipSelf: true
						});
					}
				},
				// svgr handles the `?react` query -> React component
				svgr(),
				// CRA-faithful .svg dual export: replicate @svgr/webpack so that
				//   import url from './x.svg'            -> the asset URL (default)
				//   import { ReactComponent } from './x.svg' -> the React component
				{
					name: 'cra-svg-dual-export',
					enforce: 'pre',
					load(id: string) {
						const [file, query] = id.split('?');
						if (file.endsWith('.svg') && !query) {
							return (
								`export { default } from ${JSON.stringify(
									file + '?url'
								)};\n` +
								`export { default as ReactComponent } from ${JSON.stringify(
									file + '?react'
								)};`
							);
						}
						return null;
					}
				}
			],
			// `../public` is already copied/served by staticDirs above. Vite's
			// default publicDir ('public') would copy the same tree into
			// storybook-static concurrently with Storybook's own static-file
			// copy (they run in one Promise.all), and the two writers race on
			// mkdir storybook-static/static — a flaky EEXIST that killed the
			// Docker build gate. One writer only: Storybook's.
			publicDir: false,
			// CRA components read process.env.REACT_APP_*; keep them from crashing under Vite.
			define: { 'process.env': {} },
			// webpack resolved extensionless imports incl. .scss (e.g. import './x.styles'); mirror that.
			resolve: {
				// force a SINGLE React instance — otherwise Vite can bundle a 2nd copy
				// for SB internals, which breaks hooks ("Invalid hook call") and makes
				// every context return null, crashing every story via the decorator.
				dedupe: [
					'react',
					'react-dom',
					'@emotion/react',
					'@emotion/styled',
					'@mui/material',
					'@mui/icons-material'
				],
				extensions: [
					'.mjs',
					'.js',
					'.mts',
					'.ts',
					'.jsx',
					'.tsx',
					'.json',
					'.scss',
					'.css',
					'.sass'
				]
			},
			css: {
				preprocessorOptions: {
					scss: {
						// mirror config/webpack.config.js: prepend the global settings.scss
						additionalData: `@import "${settingsMain}"; `,
						// let bare imports resolve from src + node_modules (webpack had includePaths)
						loadPaths: [srcDir, nodeModules],
						// webpack used `~pkg` to mean node_modules; dart-sass doesn't — strip it.
						importers: [
							{
								findFileUrl(url: string) {
									if (!url.startsWith('~')) return null;
									return pathToFileURL(
										path.resolve(nodeModules, url.slice(1))
									);
								}
							}
						]
					}
				}
			},
			// Avoid Vite/MUI circular prebundle races that crash the preview with
			// "styled_default is not a function" (blank canvas for every story).
			optimizeDeps: {
				include: [
					'@emotion/react',
					'@emotion/styled',
					'@mui/material',
					'@mui/material/styles',
					'@mui/material/styles/styled',
					'@mui/system',
					'@mui/icons-material'
				]
			}
		});
	}
};
export default config;
