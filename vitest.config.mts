import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.test.{ts,tsx}'],
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
