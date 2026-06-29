import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

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
		'../src/components/{box,card,modal,loadingIndicator,scrollableSection,form,Page,Switch,tooltip}/**/*.stories.@(ts|tsx)'
	],
	addons: ['@storybook/addon-mcp'],
	framework: { name: '@storybook/react-vite', options: {} },
	async viteFinal(cfg) {
		return mergeConfig(cfg, {
			// NOTE (hardening): CRA's @svgr/webpack emits BOTH `default = URL` and
			// `named ReactComponent = component` for .svg. vite-plugin-svgr can't do
			// both at once cleanly, so svg-importing components are deferred to the
			// hardening phase (needs a custom svgr template / magical-svg plugin).
			// CRA components read process.env.REACT_APP_*; keep them from crashing under Vite.
			define: { 'process.env': {} },
			// webpack resolved extensionless imports incl. .scss (e.g. import './x.styles'); mirror that.
			resolve: {
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
