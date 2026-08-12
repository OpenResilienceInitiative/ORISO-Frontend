/**
 * Everything `preview-head.html` puts on the page before the preview module
 * runs — reproduced for Vitest browser mode, which serves a bare page and never
 * injects that file.
 *
 * Imported first by `vitest.setup.ts`, before `./preview`, because ES modules
 * evaluate imports in order and the values below must exist before any product
 * module is imported.
 *
 * Keep in sync with `.storybook/preview-head.html`. If these drift, a story
 * behaves differently in `npm run test:storybook` than in the Storybook UI —
 * which is the one thing this project must never allow.
 */

// draft-js (via fbjs/lib/setImmediate) dereferences the Node-style `global` at
// module scope. Storybook's preview shell provides it; a bare browser page does
// not, so every story that transitively imports the message editor would die
// with "ReferenceError: global is not defined" before rendering.
(globalThis as unknown as { global: typeof globalThis }).global ??= globalThis;

// src/api/endpoints.ts reads this at module import and throws when the Keycloak
// realm is missing. Without it the components that touch endpoints throw during
// render and Storybook's StoryErrorBoundary swaps them for the "Needs live app
// data" panel — so their play functions assert against a placeholder and fail.
(
	globalThis as unknown as {
		__ORISO_RUNTIME_CONFIG__?: Record<string, string>;
	}
).__ORISO_RUNTIME_CONFIG__ ??= {
	REACT_APP_KEYCLOAK_REALM: 'online-beratung',
	REACT_APP_KEYCLOAK_ORIGIN: 'https://auth.storybook.test',
	REACT_APP_API_URL: 'https://api.storybook.test',
	REACT_APP_MATRIX_HOMESERVER_URL: 'https://matrix.storybook.test',
	REACT_APP_ELEMENT_CALL_BASE_URL: 'https://call.storybook.test',
	REACT_APP_LIVEKIT_WS_URL: 'wss://livekit.storybook.test'
};

export {};
