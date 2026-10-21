// MUST stay the first import: it reproduces what `preview-head.html` puts on
// the page before the preview module runs, and ES modules evaluate imports in
// order. Moving it below the others breaks every story that reads the runtime
// config at import time.
import './testPreviewBootstrap';

// addon-vitest installs renderer, preview and accessibility annotations automatically.
// Keep only this required bootstrap; a manual override can silently drop addon hooks.

import { afterEach } from 'vite-plus/test';
import { finishStoryVerification } from './verification';
import { a11yVerification } from './a11yVerification';

// Storybook's returned cleanup runs before the next story. Assert and restore
// in the current test so failures and transient fallbacks keep their identity.
afterEach(async ({ task }) => {
	const errors: unknown[] = [];
	try {
		a11yVerification.finish((evidence) =>
			Object.assign(task.meta, { verificationA11y: evidence })
		);
	} catch (error) {
		errors.push(error);
	}
	try {
		await finishStoryVerification((evidence) =>
			Object.assign(task.meta, { verificationIntegrity: evidence })
		);
	} catch (error) {
		errors.push(error);
	}
	if (errors.length)
		throw new AggregateError(errors, errors.map(String).join('\n'));
});
