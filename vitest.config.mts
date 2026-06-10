import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/**/*.test.{ts,tsx}'],
		server: {
			deps: {
				// Ships ESM with extensionless internal imports; must be
				// transformed by vite instead of loaded natively by node.
				inline: ['@material/material-color-utilities']
			}
		}
	}
});
