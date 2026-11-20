import { describe, expect, it } from 'vite-plus/test';
import {
	getUndecryptedReason,
	isMissingKeyDecryptionFailure
} from './matrixDecryptionFailure';

const failedEvent = (reason: string | null) => ({
	getType: () => 'm.room.encrypted',
	getContent: () => ({ msgtype: 'm.bad.encrypted' }),
	getClearContent: () => ({ msgtype: 'm.bad.encrypted' }),
	isDecryptionFailure: () => true,
	decryptionFailureReason: reason
});

describe('missing-key classification (#1827)', () => {
	it.each([
		'MEGOLM_UNKNOWN_INBOUND_SESSION_ID',
		'MEGOLM_KEY_WITHHELD',
		'MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE',
		'HISTORICAL_MESSAGE_NO_KEY_BACKUP',
		'HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED',
		'HISTORICAL_MESSAGE_WORKING_BACKUP',
		'HISTORICAL_MESSAGE_USER_NOT_JOINED'
	])('treats %s as "key missing on this device"', (reason) => {
		expect(isMissingKeyDecryptionFailure(failedEvent(reason))).toBe(true);
		expect(getUndecryptedReason(failedEvent(reason))).toBe('missing-key');
	});

	it.each([
		'OLM_UNKNOWN_MESSAGE_INDEX',
		'SENDER_IDENTITY_PREVIOUSLY_VERIFIED',
		'UNSIGNED_SENDER_DEVICE',
		'UNKNOWN_SENDER_DEVICE',
		'UNKNOWN_ERROR',
		null
	])('keeps %s as a generic undecryptable message', (reason) => {
		expect(isMissingKeyDecryptionFailure(failedEvent(reason))).toBe(false);
		expect(getUndecryptedReason(failedEvent(reason))).toBe('other');
	});

	it('does not classify an encrypted event that is still decrypting', () => {
		const pending = {
			getType: () => 'm.room.encrypted',
			getContent: () => ({ algorithm: 'm.megolm.v1.aes-sha2' }),
			getClearContent: () => undefined,
			isDecryptionFailure: () => false,
			decryptionFailureReason: null
		};
		expect(getUndecryptedReason(pending)).toBe('other');
		expect(isMissingKeyDecryptionFailure(pending)).toBe(false);
	});

	it('returns null for a readable message, even with a stale failure reason', () => {
		const readable = {
			getType: () => 'm.room.message',
			getContent: () => ({ msgtype: 'm.text', body: 'Hallo' }),
			getClearContent: () => ({ msgtype: 'm.text', body: 'Hallo' }),
			isDecryptionFailure: () => false,
			decryptionFailureReason: 'MEGOLM_UNKNOWN_INBOUND_SESSION_ID'
		};
		expect(getUndecryptedReason(readable)).toBeNull();
		expect(isMissingKeyDecryptionFailure(readable)).toBe(false);
	});
});
