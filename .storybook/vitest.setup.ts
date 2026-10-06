// MUST stay the first import: it reproduces what `preview-head.html` puts on
// the page before the preview module runs, and ES modules evaluate imports in
// order. Moving it below the others breaks every story that reads the runtime
// config at import time.
import './testPreviewBootstrap';

import { afterEach, beforeAll, beforeEach } from 'vitest';
import { setProjectAnnotations } from '@storybook/react-vite';
import * as a11yAnnotations from '@storybook/addon-a11y/preview';

// Reuse the exact preview the Storybook UI renders with (M3 scheme decorator,
// i18n, router, realtime mocks) so a component test can never pass against a
// different environment than the one a human reviews in the browser.
import * as previewAnnotations from './preview';

// Explicit annotations disable addon-vitest's automatic provisioning. Include
// axe's hooks so a11y.test: 'error' also fails the headless component tests.
const annotations = setProjectAnnotations([
	a11yAnnotations,
	previewAnnotations
]);

beforeAll(annotations.beforeAll);

// Storybook pauses animations before its accessibility afterEach hook. When
// axe throws, runStory skips that pause's cleanup. Remove only the exact new
// Storybook pause stylesheet so a failed audit cannot freeze the next story.
const storybookPauseStyle =
	'*, *:before, *:after { animation-delay: 0s !important; animation-direction: reverse !important; animation-play-state: paused !important; transition: none !important; }';
let stylesBeforeTest = new Set<HTMLStyleElement>();
beforeEach(() => {
	stylesBeforeTest = new Set(document.head.querySelectorAll('style'));
});
afterEach(() => {
	document.head.querySelectorAll('style').forEach((style) => {
		if (
			!stylesBeforeTest.has(style) &&
			style.textContent?.replace(/\s+/g, ' ').trim() ===
				storybookPauseStyle
		) {
			style.remove();
		}
	});
});
