const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const { defineConfig } = require('cypress');

// @ts-ignore
const wp = require('@cypress/webpack-preprocessor');

const appSrc = path.resolve(__dirname, 'src');
const appExtensions = path.resolve(appSrc, 'extensions');
const mainSettings = path
	.resolve(appSrc, 'resources/styles/settings.scss')
	.replace(/\\/g, '/');
const extensionSettings = path.resolve(
	appExtensions,
	'resources/styles/settings.scss'
);

const getSassAdditionalData = (content) => {
	let imports = `@import "${mainSettings}"; `;

	if (fs.existsSync(extensionSettings)) {
		imports += `@import "${extensionSettings.replace(/\\/g, '/')}"; `;
	}

	return `${imports} ${content}`;
};

const styleLoaders = (modules) => [
	require.resolve('style-loader'),
	{
		loader: require.resolve('css-loader'),
		options: modules
			? {
					modules: {
						mode: 'local'
					}
				}
			: undefined
	},
	{
		loader: require.resolve('resolve-url-loader'),
		options: {
			sourceMap: true,
			root: appSrc
		}
	},
	{
		loader: require.resolve('sass-loader'),
		options: {
			additionalData: getSassAdditionalData,
			sourceMap: true
		}
	}
];

const options = {
	webpackOptions: {
		resolve: {
			// App code imports stylesheets without extension (`import './x.styles'`),
			// as the app bundler allows; without `.scss` here those specs fail to bundle.
			extensions: ['.ts', '.tsx', '.js', '.jsx', '.scss'],
			alias: {
				'matrix-js-sdk$': path.resolve(
					__dirname,
					'cypress/support/stubs/matrix-js-sdk.js'
				),
				'matrix-js-sdk/lib/browser-index.js$': path.resolve(
					__dirname,
					'cypress/support/stubs/matrix-js-sdk.js'
				),
				'matrix-js-sdk/lib/webrtc/call$': path.resolve(
					__dirname,
					'cypress/support/stubs/matrix-js-sdk.js'
				),
				'matrix-js-sdk/lib/webrtc/callFeed$': path.resolve(
					__dirname,
					'cypress/support/stubs/matrix-js-sdk.js'
				),
				'matrix-js-sdk/lib/webrtc/groupCall$': path.resolve(
					__dirname,
					'cypress/support/stubs/matrix-js-sdk.js'
				)
			}
		},
		module: {
			rules: [
				{
					test: /\.js$/,
					include:
						/node_modules[\\/]@material[\\/]material-color-utilities/,
					resolve: { fullySpecified: false }
				},
				{
					oneOf: [
						{
							test: /\.tsx?$/,
							loader: 'ts-loader',
							options: { transpileOnly: true }
						},
						{
							test: /\.module\.s[ac]ss$/,
							use: styleLoaders(true)
						},
						{
							test: /\.(css|scss|sass)$/,
							exclude: /\.module\.s[ac]ss$/,
							use: styleLoaders(false)
						},
						{
							test: /\.svg$/,
							issuer: /\.[jt]sx?$/,
							use: [
								{
									loader: require.resolve('@svgr/webpack'),
									options: {
										exportType: 'named',
										titleProp: true,
										ref: true,
										svgo: false,
										jsxRuntime: 'automatic'
									}
								},
								{
									loader: require.resolve('file-loader'),
									options: {
										name: 'static/media/[name].[hash].[ext]'
									}
								}
							]
						},
						{
							test: /\.svg$/,
							issuer: { not: /\.[jt]sx?$/ },
							type: 'asset/resource'
						},
						{
							test: /\.(bmp|gif|jpe?g|png|webp|woff2?|eot|ttf|otf|mp3)$/,
							type: 'asset/resource'
						}
					]
				}
			]
		}
	}
};

let conf;
try {
	conf = require('./src/extensions/cypress/cypress.json') || {};
} catch (e) {
	console.log('No cypress.json file found, using default configuration');
	conf = {};
}

// Specs being repaired under FE#2572. CYPRESS_QUARANTINE=exclude runs the
// blocking suite without them; CYPRESS_QUARANTINE=only runs just them.
const quarantinedSpecs = require('./cypress/quarantine.json').specs;
const applyQuarantine = (config) => {
	const mode = process.env.CYPRESS_QUARANTINE;
	if (mode === 'exclude') {
		config.e2e.excludeSpecPattern = [
			...[].concat(config.e2e.excludeSpecPattern || []),
			...quarantinedSpecs
		];
	} else if (mode === 'only') {
		config.e2e.specPattern = quarantinedSpecs;
	}
	return config;
};

module.exports = defineConfig(
	applyQuarantine(
		_.mergeWith(
			{
				e2e: {
					testIsolation: true,
					baseUrl: 'http://localhost:9001',
					supportFile: 'cypress/support/e2e.{js,jsx,ts,tsx}',
					setupNodeEvents(on, config) {
						on('file:preprocessor', wp(options));
					},
					specPattern: ['cypress/e2e/**/*.cy.ts']
				},
				component: {
					devServer: {
						framework: 'react',
						bundler: 'webpack',
						webpackConfig: options.webpackOptions
					},
					specPattern: ['cypress/component/**/*.cy.tsx'],
					supportFile: false
				},
				env: {
					CYPRESS_WS_URL:
						process.env.CYPRESS_WS_URL ||
						process.env.REACT_APP_API_URL
				},
				retries: {
					runMode: 2
				},
				experimentalMemoryManagement: true,
				numTestsKeptInMemory: 20,
				video: false,
				chromeWebSecurity: false,
				viewportWidth: 1200,
				viewportHeight: 800,
				defaultCommandTimeout: 30000,
				modifyObstructiveCode: false
			},
			conf,
			(objValue, srcValue) =>
				_.isArray(objValue) ? objValue.concat(srcValue) : undefined
		)
	)
);
