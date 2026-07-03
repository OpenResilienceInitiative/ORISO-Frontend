import type { StorybookConfig } from '@storybook/react-webpack5';
import * as webpackConfigFactory from '../config/webpack.config';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Configuration } from 'webpack';
import webpack from 'webpack';

const projectRoot = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'..'
);
const projectNodeModules = path.join(projectRoot, 'node_modules');
const requireProject = createRequire(path.join(projectRoot, 'package.json'));

const absolutizeResolveModule = (dir: string) =>
	dir === 'node_modules'
		? projectNodeModules
		: path.isAbsolute(dir)
			? dir
			: path.join(projectRoot, dir);

const storybookExcludedWebpackPlugins = new Set([
	'CopyPlugin',
	'ESLintWebpackPlugin',
	'ForkTsCheckerWebpackPlugin',
	'ForkTsCheckerWarningWebpackPlugin',
	'HtmlWebpackPlugin',
	'InterpolateHtmlPlugin',
	'ReactRefreshPlugin'
]);

const isStorybookSafeWebpackPlugin = (plugin: {
	constructor?: { name?: string };
}) => !storybookExcludedWebpackPlugins.has(plugin?.constructor?.name || '');

/** Storybook 7 only auto-switches this shim for react-dom@18; React 19 needs the createRoot-based shim. */
const reactDomShimReact18 = requireProject.resolve(
	'@storybook/react-dom-shim/dist/react-18'
);
const domhandlerLegacyNodeEntry = path.join(
	projectRoot,
	'node_modules',
	'html-dom-parser',
	'node_modules',
	'domhandler',
	'lib',
	'node.js'
);

const config: StorybookConfig = {
	stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
	staticDirs: ['./static', '../public'],
	addons: [
		'@storybook/addon-links',
		'@storybook/addon-essentials',
		'@storybook/addon-interactions',
		'storybook-i18n'
	],
	framework: {
		name: '@storybook/react-webpack5',
		options: {}
	},
	webpackFinal: async (config, { configType }) => {
		// @ts-ignore
		const webpackConfig = webpackConfigFactory.default(
			configType.toLowerCase()
		);

		const resolvePlugins = (webpackConfig.resolve.plugins || []).filter(
			(p: { constructor?: { name?: string } }) =>
				p?.constructor?.name !== 'ModuleScopePlugin'
		);
		const webpackPlugins = (webpackConfig.plugins || []).filter(
			isStorybookSafeWebpackPlugin
		);

		return {
			...config,
			output: {
				...config.output,
				publicPath: ''
			},
			resolve: {
				...config.resolve,
				modules: [
					...(webpackConfig.resolve.modules || []).map(
						absolutizeResolveModule
					),
					...(config.resolve.modules || []).map(
						absolutizeResolveModule
					)
				],
				extensions: [
					...webpackConfig.resolve.extensions,
					...config.resolve.extensions
				],
				alias: {
					...webpackConfig.resolve.alias,
					...config.resolve.alias,
					'@storybook/react-dom-shim': reactDomShimReact18,
					// html-dom-parser@1.x imports this legacy subpath, but
					// domhandler@5 blocks it via package exports when hoisted.
					'domhandler/lib/node$': domhandlerLegacyNodeEntry,
					'react-dom$': requireProject.resolve('react-dom')
				},
				plugins: resolvePlugins
			},
			plugins: [
				new webpack.NormalModuleReplacementPlugin(
					/^react\/jsx-runtime$/,
					requireProject.resolve('react/jsx-runtime')
				),
				new webpack.NormalModuleReplacementPlugin(
					/^react\/jsx-dev-runtime$/,
					requireProject.resolve('react/jsx-dev-runtime')
				),
				new webpack.NormalModuleReplacementPlugin(
					/^domhandler\/lib\/node$/,
					domhandlerLegacyNodeEntry
				),
				// Ignore intro.js CSS entirely in Storybook - it's not needed
				new webpack.IgnorePlugin({
					resourceRegExp: /intro\.js\/introjs\.css$/
				}),
				...webpackPlugins,
				...config.plugins
			],
			module: {
				...config.module,
				rules: [
					// @material/material-color-utilities ships ESM with
					// extensionless internal imports; without this the
					// "fully specified" rule rejects them (the app build
					// already accommodates this, Storybook's does not).
					{
						test: /\.js$/,
						include:
							/node_modules[\\/]@material[\\/]material-color-utilities/,
						resolve: { fullySpecified: false }
					},
					// Exclude svg from storybook file-loader
					...config.module.rules.map((r: any) => {
						if (r.test && /svg/.test(r.test)) {
							return { ...r, exclude: /\.svg$/i };
						}
						return r;
					}),
					// Filter webpackConfig rules
					...webpackConfig.module.rules.map((r) => {
						if (!r.oneOf) {
							return r;
						}
						return {
							...r,
							oneOf: r.oneOf.filter(
								(o: any) => o.type !== 'asset/resource'
							)
						};
					})
				]
			}
		} as Configuration;
	},
	docs: {
		autodocs: 'tag',
		defaultName: 'Documentation',
		docsMode: false
	},
	typescript: {
		// The full app graph is large enough that react-docgen-typescript can
		// leave the preview stuck at DocGenPlugin during local development.
		reactDocgen: false,
		reactDocgenTypescriptOptions: {
			shouldExtractLiteralValuesFromEnum: true,
			propFilter: (prop) => {
				if (prop.parent) {
					return !prop.parent.fileName.includes('node_modules');
				}
				return true;
			}
		}
	}
};
export default config;
