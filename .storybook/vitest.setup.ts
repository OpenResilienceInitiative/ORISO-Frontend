// MUST stay the first import: it reproduces what `preview-head.html` puts on
// the page before the preview module runs, and ES modules evaluate imports in
// order. Moving it below the others breaks every story that reads the runtime
// config at import time.
import './testPreviewBootstrap';

import { beforeAll } from 'vitest';
import { setProjectAnnotations } from '@storybook/react-vite';

// Reuse the exact preview the Storybook UI renders with (M3 scheme decorator,
// i18n, router, realtime mocks) so a component test can never pass against a
// different environment than the one a human reviews in the browser.
import * as previewAnnotations from './preview';

const annotations = setProjectAnnotations([previewAnnotations]);

beforeAll(annotations.beforeAll);
