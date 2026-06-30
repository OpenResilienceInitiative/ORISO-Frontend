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
		// PROOF originals
		'../src/components/{text,tag,headline,loadingSpinner}/**/*.stories.@(ts|tsx)',
		// Atom batch 1 (generated)
		'../src/components/{box,card,modal,loadingIndicator,scrollableSection,form,Page,Switch,tooltip}/**/*.stories.@(ts|tsx)',
		// Template (composes lower levels)
		'../src/components/legalPageWrapper/**/*.stories.@(ts|tsx)',
		// Molecule batch 1 (generated)
		'../src/components/{infoTooltip,tagSelect,banner,select,editableData,flyoutMenu,generateQrCode,emptyState}/**/*.stories.@(ts|tsx)',
		// Organism batch 1 (generated)
		'../src/components/{header,sessionMenu,askerInfo,twoFactorAuth,appointment,notificationsCenter,walkthrough,banUser}/**/*.stories.@(ts|tsx)'
	],
	// SB7 served these (compound-web.css etc. referenced by preview-head.html)
	staticDirs: ['./static', '../public'],
	addons: ['@storybook/addon-mcp'],
	framework: { name: '@storybook/react-vite', options: {} },
	async viteFinal(cfg) {
		return mergeConfig(cfg, {
			plugins: [
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
			// CRA components read process.env.REACT_APP_*; keep them from crashing under Vite.
			define: { 'process.env': {} },
			// webpack resolved extensionless imports incl. .scss (e.g. import './x.styles'); mirror that.
			resolve: {
				// force a SINGLE React instance — otherwise Vite can bundle a 2nd copy
				// for SB internals, which breaks hooks ("Invalid hook call") and makes
				// every context return null, crashing every story via the decorator.
				dedupe: ['react', 'react-dom'],
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
			}
		});
	}
};
export default config;
