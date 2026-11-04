// @vitest-environment oriso-jsdom
// @vitest-environment-options {"html":"<!DOCTYPE html><html><body><div id=\"constructor-marker\"></div><script>document.getElementById(\"constructor-marker\").textContent = \"ran\";throw new Error(\"ORISO_CANARY_CONSTRUCTOR_ERROR\");</script></body></html>","url":"https://oriso-native-canary.test/constructor-fault","runScripts":"dangerously"}

import { expect, it } from 'vite-plus/test';

it('constructor script runs and its real exception remains visible', () => {
	expect(document.getElementById('constructor-marker')?.textContent).toBe(
		'ran'
	);
});
