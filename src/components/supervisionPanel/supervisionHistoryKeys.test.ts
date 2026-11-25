import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	acceptSupervisionHistory,
	resetAcceptedSupervisionHistory,
	shareSupervisionHistory
} from './supervisionHistoryKeys';

const ROOM = '!side:dev.oriso.org';
const MONA = '@mona:dev.oriso.org';
const BART = '@bart:dev.oriso.org';

describe('shareSupervisionHistory (counsellor side)', () => {
	it('sends the side room history keys to the new supervisor', async () => {
		const shareRoomHistoryWithUser = vi.fn(async () => undefined);
		const client = { getCrypto: () => ({ shareRoomHistoryWithUser }) };

		await expect(shareSupervisionHistory(client, ROOM, MONA)).resolves.toBe(
			true
		);
		expect(shareRoomHistoryWithUser).toHaveBeenCalledWith(ROOM, MONA);
	});

	it('does nothing without a valid room, user or crypto', async () => {
		const shareRoomHistoryWithUser = vi.fn(async () => undefined);
		const client = { getCrypto: () => ({ shareRoomHistoryWithUser }) };

		expect(await shareSupervisionHistory(client, undefined, MONA)).toBe(
			false
		);
		expect(await shareSupervisionHistory(client, ROOM, 'mona')).toBe(false);
		expect(await shareSupervisionHistory({}, ROOM, MONA)).toBe(false);
		expect(await shareSupervisionHistory(undefined, ROOM, MONA)).toBe(
			false
		);
		expect(shareRoomHistoryWithUser).not.toHaveBeenCalled();
	});

	it('never lets a failed share break the swap', async () => {
		const client = {
			getCrypto: () => ({
				shareRoomHistoryWithUser: vi.fn(async () => {
					throw new Error('own identity not verified');
				})
			})
		};
		await expect(shareSupervisionHistory(client, ROOM, MONA)).resolves.toBe(
			false
		);
	});
});

describe('acceptSupervisionHistory (new supervisor side)', () => {
	beforeEach(() => resetAcceptedSupervisionHistory());

	it('imports the counsellor bundle once per room and page load', async () => {
		const maybeAcceptKeyBundle = vi.fn(async () => undefined);
		const client = { cryptoBackend: { maybeAcceptKeyBundle } };

		expect(await acceptSupervisionHistory(client, ROOM, BART)).toBe(true);
		expect(await acceptSupervisionHistory(client, ROOM, BART)).toBe(false);
		expect(maybeAcceptKeyBundle).toHaveBeenCalledTimes(1);
		expect(maybeAcceptKeyBundle).toHaveBeenCalledWith(ROOM, BART);
	});

	it('tries again after a failure', async () => {
		const maybeAcceptKeyBundle = vi
			.fn<(roomId: string, inviter: string) => Promise<void>>()
			.mockRejectedValueOnce(new Error('no bundle yet'))
			.mockResolvedValue(undefined);
		const client = { cryptoBackend: { maybeAcceptKeyBundle } };

		expect(await acceptSupervisionHistory(client, ROOM, BART)).toBe(false);
		expect(await acceptSupervisionHistory(client, ROOM, BART)).toBe(true);
	});

	it('does nothing when the SDK has no bundle support or ids are missing', async () => {
		expect(await acceptSupervisionHistory({}, ROOM, BART)).toBe(false);
		expect(
			await acceptSupervisionHistory(
				{ cryptoBackend: { maybeAcceptKeyBundle: vi.fn() } },
				ROOM,
				null
			)
		).toBe(false);
	});
});
