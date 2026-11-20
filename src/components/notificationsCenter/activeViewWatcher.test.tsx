// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { ComposerStoryDecorator } from '../messageSubmitInterface/__storybook__/composerStoryDecorator';
import { installActiveViewWatcher } from './activeViewWatcher';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it('detects string, URL and Request active-view calls and restores its fetch', async () => {
	const delegate = vi.fn(async () => new Response(null, { status: 204 }));
	vi.stubGlobal('fetch', delegate);
	const calls: string[] = [];
	const restore = installActiveViewWatcher(calls);
	await fetch('https://example.test/service/active-view');
	await fetch(new URL('https://example.test/service/active-view'));
	await fetch(new Request('https://example.test/service/active-view'));
	await fetch('https://example.test/service/other');
	expect(calls).toEqual(
		Array(3).fill('https://example.test/service/active-view')
	);
	restore();
	expect(globalThis.fetch).toBe(delegate);
});

it('removes observer and composer layers on StrictMode remount and unmount', async () => {
	const delegate = vi.fn(async () => new Response(null, { status: 204 }));
	vi.stubGlobal('fetch', delegate);
	const calls: string[] = [];
	const restore = installActiveViewWatcher(calls);
	const view = render(
		<React.StrictMode>
			<ComposerStoryDecorator>
				<div />
			</ComposerStoryDecorator>
		</React.StrictMode>
	);
	await fetch(new Request('https://example.test/service/active-view'));
	expect(calls).toHaveLength(1);
	view.unmount();
	const second = render(
		<React.StrictMode>
			<ComposerStoryDecorator>
				<div />
			</ComposerStoryDecorator>
		</React.StrictMode>
	);
	await fetch(new Request('https://example.test/service/active-view'));
	expect(calls).toHaveLength(2);
	second.unmount();
	restore();
	expect(globalThis.fetch).toBe(delegate);
});
