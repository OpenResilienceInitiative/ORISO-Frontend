// @vitest-environment oriso-jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

/* Each screen's module is replaced by a stub that writes its name down when it
   is loaded, so a test sees exactly which chunks a call asked the browser for.
   The stubs are registered again before every test: a stub that was loaded once
   is not loaded a second time otherwise. */
const loaded = vi.hoisted(() => [] as string[]);
const SCREENS: Array<[path: string, name: string, exports: object]> = [
	['../session/SessionView', 'SessionView', { SessionView: () => null }],
	['../enquiry/WriteEnquiry', 'WriteEnquiry', { WriteEnquiry: () => null }],
	[
		'../messageSubmitInterface/messageSubmitInterfaceComponent',
		'MessageComposer',
		{ MessageSubmitInterfaceComponent: () => null }
	],
	[
		'../groupChat/entryRoom/GroupEntryRoom',
		'GroupEntryRoom',
		{ GroupEntryRoom: () => null }
	],
	['../videoCall/VideoCall', 'VideoCall', { default: () => null }],
	[
		'./AuthenticatedApp',
		'AuthenticatedApp',
		{ AuthenticatedApp: () => null }
	],
	['../../services/matrixClientService', 'matrixClientService', {}],
	['../../services/matrixLiveEventBridge', 'matrixLiveEventBridge', {}]
];
const stubScreens = () =>
	SCREENS.forEach(([path, name, exports]) =>
		vi.doMock(path, () => {
			loaded.push(name);
			return exports;
		})
	);

const chunks = () => import('./appChunks');
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * ORISO-Frontend#1737. The click on a waiting room's button must land in a
 * screen that is already loaded, so the animation never holds the person at
 * red for a download. These are the chunks behind each button.
 */
describe('appChunks', () => {
	beforeEach(() => {
		loaded.length = 0;
		vi.resetModules();
		// The test setup replaces the warm-up with a no-op; this tests the real one.
		vi.doUnmock('./appChunks');
		stubScreens();
	});
	afterEach(() => vi.restoreAllMocks());

	describe('loadEntryScreens', () => {
		it("loads the chat's screens and its composer, so the 'screens' milestone covers the whole way in", async () => {
			const { loadEntryScreens } = await chunks();
			await loadEntryScreens();
			expect([...loaded].sort()).toEqual([
				'MessageComposer',
				'SessionView',
				'WriteEnquiry'
			]);
		});

		it("loads the group's entry room for someone who came through a group link", async () => {
			const { loadEntryScreens } = await chunks();
			await loadEntryScreens(true);
			expect(loaded).toEqual(['GroupEntryRoom']);
		});
	});

	describe('warmClosingDestination', () => {
		const chat = ['MessageComposer', 'SessionView', 'WriteEnquiry'];

		it('warms the chat for a room that ends on the message field', async () => {
			const { warmClosingDestination } = await chunks();
			warmClosingDestination('messageField');
			await vi.waitFor(() => expect([...loaded].sort()).toEqual(chat));
		});

		it('warms the video call, and only it, for a room that ends on the call', async () => {
			const { warmClosingDestination } = await chunks();
			warmClosingDestination('call');
			await vi.waitFor(() => expect(loaded).toEqual(['VideoCall']));
			await settled();
			expect(loaded).toEqual(['VideoCall']);
		});

		it('never throws when a chunk cannot be loaded, and asks again at the next press: the head start is lost, the person still arrives', async () => {
			let attempts = 0;
			const stub = () => ({ default: () => null });
			vi.doMock('../videoCall/VideoCall', () => {
				attempts += 1;
				if (attempts === 1) throw new Error('offline');
				return stub();
			});
			const unhandled = vi.fn();
			process.on('unhandledRejection', unhandled);
			try {
				const { warmClosingDestination } = await chunks();
				expect(() => warmClosingDestination('call')).not.toThrow();
				await vi.waitFor(() => expect(attempts).toBe(1));
				await settled();
				warmClosingDestination('call');
				await vi.waitFor(() => expect(attempts).toBe(2));
				expect(unhandled).not.toHaveBeenCalled();
			} finally {
				process.off('unhandledRejection', unhandled);
			}
		});
	});

	describe('warmAppChunks', () => {
		it('also warms the composer: registration is the first of the rooms that does', async () => {
			const { warmAppChunks } = await chunks();
			warmAppChunks();
			await vi.waitFor(() => {
				expect(loaded).toContain('MessageComposer');
				expect(loaded).toContain('SessionView');
			});
		});
	});

	describe('warmWhenIdle', () => {
		it('runs the task when the browser is idle and can be cancelled', async () => {
			const { warmWhenIdle } = await chunks();
			const handle = 7;
			const request = vi.fn((_task: () => void) => handle);
			const cancel = vi.fn();
			Object.assign(window, {
				requestIdleCallback: request,
				cancelIdleCallback: cancel
			});
			const task = vi.fn();
			const stop = warmWhenIdle(task);
			expect(request).toHaveBeenCalledWith(task);
			expect(task).not.toHaveBeenCalled();
			stop();
			expect(cancel).toHaveBeenCalledWith(handle);
			delete (window as unknown as Record<string, unknown>)
				.requestIdleCallback;
			delete (window as unknown as Record<string, unknown>)
				.cancelIdleCallback;
		});

		it('falls back to a timer where there is no idle callback (Safari)', async () => {
			vi.useFakeTimers();
			try {
				const { warmWhenIdle } = await chunks();
				const task = vi.fn();
				const stop = warmWhenIdle(task);
				expect(task).not.toHaveBeenCalled();
				vi.advanceTimersByTime(999);
				expect(task, 'not before a second').not.toHaveBeenCalled();
				vi.advanceTimersByTime(1);
				expect(task).toHaveBeenCalledTimes(1);
				const second = vi.fn();
				warmWhenIdle(second)();
				vi.advanceTimersByTime(2000);
				expect(
					second,
					'cancelled before it ran'
				).not.toHaveBeenCalled();
				stop();
			} finally {
				vi.useRealTimers();
			}
		});
	});
});
