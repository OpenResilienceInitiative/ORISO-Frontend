import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { getRuntimeConfigProblems } from './resources/scripts/runtimeConfig';
import {
	ConfigurationError,
	reportRuntimeConfigProblems
} from './components/configurationError/ConfigurationError';
import { loadChunk } from './utils/chunkLoadRecovery';

// ORISO-Helm#368: a deployed build never guesses a service URL. The check runs
// before any app module is evaluated, because some of them read required keys
// at import time. The dev server proxies API calls same-origin, so only
// production builds are gated.
const problems =
	process.env.NODE_ENV === 'production' ? getRuntimeConfigProblems() : [];

if (problems.length > 0) {
	reportRuntimeConfigProblems(problems);
	const container = document.getElementById('appRoot');
	if (container) {
		createRoot(container).render(
			<ConfigurationError problems={problems} />
		);
	}
} else {
	void loadChunk(() => import('./startApp'));
}
