import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

/**
 * The webpack build turns `*.svg` into a module with a `ReactComponent` named
 * export (SVGR) plus a URL default export. Vitest has no such loader, so any
 * component that renders an inline icon blows up with "Element type is
 * invalid". Stub both exports — tests assert behaviour, not path data.
 */
const svgStub = {
	name: 'oriso-svg-stub',
	enforce: 'pre' as const,
	load(id: string) {
		if (!id.split('?')[0].endsWith('.svg')) {
			return null;
		}
		return [
			"import * as React from 'react';",
			'export const ReactComponent = (props) =>',
			"  React.createElement('svg', props);",
			"export default 'test-file-stub';"
		].join('\n');
	}
};

/**
 * Two Vitest projects, run separately (see package.json):
 *
 *   `unit`      — jsdom, `src/**\/*.test.tsx`. What `npm run test:unit` and CI run.
 *   `storybook` — every story executed in a real Chromium via Vitest browser
 *                 mode: renders the story, runs its `play` function, and fails
 *                 on axe violations (WCAG 2.2 AA) because `.storybook/preview.tsx`
 *                 sets `a11y.test: 'error'`. Needs Playwright browsers
 *                 (`npx playwright install chromium`), so it is not part of
 *                 `test:unit` and gets its own CI job.
 *
 * The `storybook` project deliberately does NOT extend this file: the svgStub
 * above would replace every icon with an empty `<svg>`, and a story rendered
 * with stubbed icons is not the story a reviewer sees in the browser. It picks
 * up the real SVGR/SCSS pipeline from `.storybook/main.ts` instead.
 */
export default defineConfig({
	plugins: [svgStub],
	ssr: {
		// Same reason as `test.server.deps.inline` below, but at the Vite
		// level so `vite-node` (which runs scripts/generate-call-theme.ts)
		// transforms the package instead of handing it to node's ESM loader.
		noExternal: ['@material/material-color-utilities']
	},
	resolve: {
		// The webpack build resolves extensionless style imports
		// (e.g. `import './session.styles'`) to .scss files; mirror that so
		// components using this pattern can be imported in tests. Vitest
		// stubs style modules by default, so no sass compile happens.
		extensions: [
			'.mjs',
			'.js',
			'.mts',
			'.ts',
			'.jsx',
			'.tsx',
			'.json',
			'.scss',
			'.css'
		]
	},
	test: {
		coverage: {
			provider: 'v8',
			// `text` for the terminal, `html` for humans, `json-summary` for the
			// coverage widget in Storybook's sidebar.
			reporter: ['text', 'html', 'json-summary'],
			reportsDirectory: './coverage',
			// Product code only — stories, mocks and generated types would
			// otherwise dominate the percentage and make it meaningless.
			include: ['src/**/*.{ts,tsx}'],
			exclude: [
				'src/**/*.stories.@(ts|tsx)',
				'src/**/*.test.@(ts|tsx)',
				'src/**/__storybook__/**',
				'src/**/__mocks__/**',
				'src/test/**',
				'src/**/*.d.ts'
			]
		},
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					include: ['src/**/*.test.{ts,tsx}'],
					// Explicit rather than inherited from the defaults, so the intent is
					// visible: a test or hook that never settles must fail here, not sit
					// until CI's job timeout kills the whole run. Note these only catch
					// asynchronous stalls — a synchronous block cannot be interrupted by a
					// JS timer, which is why no test in this suite may spawn a child
					// process synchronously.
					testTimeout: 10_000,
					hookTimeout: 15_000,
					teardownTimeout: 15_000,
					// Polyfill the layout APIs jsdom lacks (Range.getClientRects,
					// Element.scrollIntoView) so TipTap's focus/scroll path doesn't throw
					// an async unhandled error that flakes the composer emoji test in CI.
					// Guarded internally, so it is a no-op under the node environment.
					setupFiles: ['./src/test/jsdomPolyfills.ts'],
					// The app's runtimeConfig reads REACT_APP_* vars at module load and
					// throws if the Keycloak realm is missing. Vite only auto-loads VITE_*
					// vars, so provide the minimum here to let component/router tests that
					// transitively import endpoints/runtimeConfig mount. Values are dummies.
					env: {
						REACT_APP_KEYCLOAK_REALM: 'online-beratung',
						REACT_APP_API_URL: 'https://api.test.local'
					},
					server: {
						deps: {
							// Ships ESM with extensionless internal imports; must be
							// transformed by vite instead of loaded natively by node.
							inline: ['@material/material-color-utilities']
						}
					}
				}
			},
			{
				plugins: [storybookTest({ configDir: '.storybook' })],
				// Pre-bundle the docs blocks. Otherwise Vite only discovers them
				// when the first .mdx / autodocs page is imported — mid-run —
				// re-optimizes, and every module request already in flight 404s
				// ("Failed to fetch dynamically imported module …/sb-vitest/deps/
				// @storybook_addon-docs_n_@storybook_react-dom-shim.js"). That
				// surfaces as a handful of unrelated stories failing at random.
				optimizeDeps: {
					include: [
						'@storybook/addon-docs > @storybook/react-dom-shim'
					]
				},
				test: {
					name: 'storybook',
					browser: {
						enabled: true,
						headless: true,
						provider: 'playwright',
						// Vitest's browser mode defaults to a 414x896 phone
						// viewport. `useResponsive().untilL` then reports mobile
						// for every story, so desktop-only affordances (the group
						// member-count badge, the header's add pill) never render
						// and their play functions fail. Stories are authored
						// desktop-first; a story that wants a phone declares it
						// via `parameters.viewport`.
						viewport: { width: 1280, height: 800 },
						instances: [
							{
								browser: 'chromium',
								context: {
									// i18next-browser-languagedetector picks the
									// language from navigator. Headless Chromium
									// reports en-US, so without this a play
									// function asserting German copy would pass in
									// a reviewer's browser and fail in CI. Pin it
									// so the suite tests the product's primary
									// language, not the machine it runs on.
									locale: 'de-DE',
									// Same argument for dates: a story rendering a
									// timestamp must not change meaning between a
									// CI runner in UTC and a laptop in CET.
									timezoneId: 'Europe/Berlin'
								}
							}
						]
					},
					setupFiles: ['./.storybook/vitest.setup.ts']
				}
			}
		]
	}
});
