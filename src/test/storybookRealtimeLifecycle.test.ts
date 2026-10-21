// @vitest-environment oriso-jsdom
import { describe, expect, it, vi } from 'vite-plus/test';
import { createInstance } from 'i18next';
import {
	closeStorybookRealtimeMocks,
	cleanupStorybookState,
	trackStorybookRealtimeMock,
	StorybookWebSocketMock
} from '../../.storybook/storybookRealtimeMocks';

describe('story-owned realtime lifecycle', () => {
	it('closes opened and connecting mocks, preventing a late open after story cleanup', async () => {
		const opened = new StorybookWebSocketMock(
			'wss://matrix.storybook.test/first'
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(opened.readyState).toBe(StorybookWebSocketMock.OPEN);
		const connecting = new StorybookWebSocketMock(
			'wss://matrix.storybook.test/second'
		);
		let lateOpens = 0;
		connecting.addEventListener('open', () => {
			lateOpens += 1;
		});
		closeStorybookRealtimeMocks();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(opened.readyState).toBe(StorybookWebSocketMock.CLOSED);
		expect(connecting.readyState).toBe(StorybookWebSocketMock.CLOSED);
		expect(lateOpens).toBe(0);
		const nextStory = new StorybookWebSocketMock(
			'wss://matrix.storybook.test/next'
		);
		expect(nextStory.readyState).toBe(StorybookWebSocketMock.CONNECTING);
		closeStorybookRealtimeMocks();
	});
	it('closes every actual socket despite an earlier throwing handler and prevents late opens', async () => {
		const first = new StorybookWebSocketMock(
			'wss://matrix.storybook.test/first-throws'
		);
		const second = new StorybookWebSocketMock(
			'wss://matrix.storybook.test/second-owned'
		);
		const lateOpen = vi.fn();
		second.onopen = lateOpen;
		first.onclose = () => {
			throw new Error('controlled-close-error');
		};
		expect(() => closeStorybookRealtimeMocks()).toThrow(
			'controlled-close-error'
		);
		expect(first.readyState).toBe(StorybookWebSocketMock.CLOSED);
		expect(second.readyState).toBe(StorybookWebSocketMock.CLOSED);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(lateOpen).not.toHaveBeenCalled();
		expect(() => closeStorybookRealtimeMocks()).not.toThrow();
	});

	it('restores the real i18n instance even when an owned socket close fails', async () => {
		const language = createInstance();
		await language.init({
			lng: 'de',
			resources: { de: { translation: {} }, en: { translation: {} } }
		});
		await language.changeLanguage('en');
		const socket = new StorybookWebSocketMock(
			'wss://matrix.storybook.test/language-restore'
		);
		socket.onclose = () => {
			throw new Error('controlled-close-before-language');
		};
		await expect(
			cleanupStorybookState(() => language.changeLanguage('de'))
		).rejects.toThrow('controlled-close-before-language');
		expect(language.language).toBe('de');
	});
	it('retains both realtime and independent language cleanup failures', async () => {
		const socket = new StorybookWebSocketMock(
			'wss://matrix.storybook.test/language-failure'
		);
		socket.onclose = () => {
			throw new Error('controlled-close-before-language');
		};
		await expect(
			cleanupStorybookState(async () => {
				await Promise.resolve();
				throw new Error('controlled-language-failure');
			})
		).rejects.toThrow(
			/controlled-close-before-language[\s\S]*controlled-language-failure/
		);
	});
	it('retains ownership for a close that failed before completion so a later cleanup can retry', () => {
		const close = vi.fn().mockImplementationOnce(() => {
			throw new Error('controlled-incomplete-close');
		});
		trackStorybookRealtimeMock({ close });
		expect(() => closeStorybookRealtimeMocks()).toThrow(
			'controlled-incomplete-close'
		);
		closeStorybookRealtimeMocks();
		expect(close).toHaveBeenCalledTimes(2);
	});
});
