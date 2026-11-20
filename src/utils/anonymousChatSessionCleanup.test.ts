// @vitest-environment oriso-jsdom
/**
 * FE#2330 / US#1601 — signing out finishes a guest's open Live Chat, but
 * never the chat of an account the person converted to a lasting one: that
 * chat is theirs to keep, and finishing it hid the history on the next sign-in.
 */
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const api = vi.hoisted(() => ({
	finish: vi.fn(),
	status: vi.fn()
}));
vi.mock('../api/apiFinishAnonymousConversation', () => ({
	apiFinishAnonymousConversation: api.finish
}));
vi.mock('../components/liveChatConversion/liveChatConversionApi', () => ({
	getConversionStatus: api.status
}));

const statusOf = (state: string) => ({
	userId: 'asker-1',
	username: 'anon_7',
	state,
	intentId: state === 'PROMOTED' ? 'intent-1' : null,
	finishedOrigin: false
});

const loadCleanup = async () => {
	vi.resetModules();
	return import('./anonymousChatSessionCleanup');
};

describe('finishing the Live Chat on sign-out', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		api.finish.mockResolvedValue(undefined);
	});

	it.each(['ELIGIBLE', 'NOT_ELIGIBLE', 'FINISH_PENDING'])(
		'finishes the open chat of a guest whose account state is %s',
		async (state) => {
			api.status.mockResolvedValue(statusOf(state));
			const cleanup = await loadCleanup();
			cleanup.registerAnonymousChatSessionForCleanup(112, 2);

			await cleanup.finishPendingAnonymousChatSession();

			expect(api.finish).toHaveBeenCalledWith(112);
		}
	);

	it.each(['PROMOTED', 'ALREADY_REGISTERED'])(
		'keeps the chat of a lasting account (%s)',
		async (state) => {
			api.status.mockResolvedValue(statusOf(state));
			const cleanup = await loadCleanup();
			cleanup.registerAnonymousChatSessionForCleanup(112, 2);

			await cleanup.finishPendingAnonymousChatSession();

			expect(api.finish).not.toHaveBeenCalled();
		}
	);

	it('keeps the chat when the account state cannot be read', async () => {
		api.status.mockRejectedValue(new Error('Invalid conversion status'));
		const cleanup = await loadCleanup();
		cleanup.registerAnonymousChatSessionForCleanup(112, 2);

		await cleanup.finishPendingAnonymousChatSession();

		expect(api.finish).not.toHaveBeenCalled();
	});

	it('does nothing when no open chat is registered', async () => {
		const cleanup = await loadCleanup();
		cleanup.registerAnonymousChatSessionForCleanup(112, 3);

		await cleanup.finishPendingAnonymousChatSession();

		expect(api.status).not.toHaveBeenCalled();
		expect(api.finish).not.toHaveBeenCalled();
	});
});
