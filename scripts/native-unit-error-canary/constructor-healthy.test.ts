// @vitest-environment oriso-jsdom
// @vitest-environment-options {"html":"<!DOCTYPE html><html><body><div id=\"constructor-marker\"></div><script>document.getElementById(\"constructor-marker\").textContent = \"ran\";</script></body></html>","url":"https://oriso-native-canary.test/constructor-healthy","runScripts":"dangerously"}

import { expect, it } from 'vite-plus/test';

it('configured constructor HTML executes without an exception', () => {
	expect(document.getElementById('constructor-marker')?.textContent).toBe(
		'ran'
	);
});
