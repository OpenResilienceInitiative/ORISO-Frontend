import { defineConfig } from 'vitest/config';

export default defineConfig({
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
		include: ['src/**/*.test.{ts,tsx}'],
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
});
