import { defineConfig } from 'vitest/config';

// Unit-test runner for pure utilities in `src/utils`.
// Component/e2e coverage continues to live in Cypress (see cypress.config.js).
export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
		globals: true
	}
});
