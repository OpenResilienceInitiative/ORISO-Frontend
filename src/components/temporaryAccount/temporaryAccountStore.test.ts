// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { apiGetTemporaryAccount } from '../../api/apiTemporaryAccount';
import {
	answerRetention,
	isDeletedGuest,
	loadTemporaryAccount,
	needsRetentionAnswer,
	resetTemporaryAccount,
	retentionOf
} from './temporaryAccountStore';

vi.mock('../../api/apiTemporaryAccount', () => ({
	apiGetTemporaryAccount: vi.fn(),
	apiPutMessageRetention: vi.fn()
}));

const guest = (overrides = {}) => ({
	medium: 'CHAT' as const,
	messageRetention: 'GUEST_DECIDES' as const,
	keepMessages: null,
	keepsMessages: false,
	deleted: false,
	...overrides
});

beforeEach(() => {
	vi.clearAllMocks();
	resetTemporaryAccount();
});

describe('temporary account rules', () => {
	it('asks only an undecided guest whose platform lets them decide', () => {
		expect(needsRetentionAnswer(guest())).toBe(true);
		expect(needsRetentionAnswer(guest({ keepMessages: true }))).toBe(false);
		expect(
			needsRetentionAnswer(
				guest({ messageRetention: 'ALWAYS_TEMPORARY' })
			)
		).toBe(false);
		expect(needsRetentionAnswer(null)).toBe(false);
	});

	it('labels the messages that go with the account', () => {
		expect(
			retentionOf(guest({ messageRetention: 'ALWAYS_TEMPORARY' }))
		).toBe('delete');
		expect(
			retentionOf(guest({ messageRetention: 'ALWAYS_PERSISTENT' }))
		).toBe('keep');
		expect(retentionOf(guest({ keepMessages: false }))).toBe('delete');
		expect(retentionOf(guest())).toBeUndefined();
		expect(retentionOf(undefined)).toBeUndefined();
	});

	it('knows a deleted guest by either field', () => {
		expect(isDeletedGuest(guest({ deleted: true }))).toBe(true);
		expect(
			isDeletedGuest({ ...guest(), deleted: undefined, isDeleted: true })
		).toBe(true);
		expect(isDeletedGuest(guest())).toBe(false);
		expect(isDeletedGuest(undefined)).toBe(false);
	});
});

describe('answerRetention', () => {
	it('keeps the saved answer, so the guest is not asked again', async () => {
		resetTemporaryAccount(guest());
		const put = vi.fn().mockResolvedValue('saved');
		await answerRetention('keep', put);
		expect(put).toHaveBeenCalledWith(true);
		vi.mocked(apiGetTemporaryAccount).mockResolvedValue(null);
		// No reload needed: the store already has the answer.
		expect(apiGetTemporaryAccount).not.toHaveBeenCalled();
	});

	it('reads the account again after a 409', async () => {
		resetTemporaryAccount(guest());
		vi.mocked(apiGetTemporaryAccount).mockResolvedValue(
			guest({ keepMessages: false })
		);
		const put = vi.fn().mockResolvedValue('alreadyDecided');
		await expect(answerRetention('keep', put)).resolves.toBe(
			'alreadyDecided'
		);
		expect(apiGetTemporaryAccount).toHaveBeenCalledOnce();
	});

	it('loads once per page', async () => {
		vi.mocked(apiGetTemporaryAccount).mockResolvedValue(guest());
		await Promise.all([loadTemporaryAccount(), loadTemporaryAccount()]);
		await loadTemporaryAccount();
		expect(apiGetTemporaryAccount).toHaveBeenCalledOnce();
	});
});
