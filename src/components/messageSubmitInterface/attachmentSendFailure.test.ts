import { describe, expect, it } from 'vite-plus/test';
import {
	canRetryAttachment,
	classifyAttachmentSendError
} from './attachmentSendFailure';

const withStatus = (httpStatus: number) =>
	Object.assign(new Error('reply'), { httpStatus });

describe('classifyAttachmentSendError', () => {
	it('trusts the abort signal, not the error name, for a cancel', () => {
		const abort = new DOMException('Aborted', 'AbortError');

		expect(classifyAttachmentSendError(abort, true)).toBe('cancelled');
		// The SDK throws the same AbortError for an XHR that died with status 0.
		expect(classifyAttachmentSendError(abort, false)).toBe('network');
	});

	it.each([
		[413, 'serverTooLarge'],
		[415, 'format'],
		[429, 'service'],
		[500, 'service'],
		[502, 'service'],
		[503, 'service'],
		[504, 'service'],
		[403, 'other']
	])('reads HTTP %i as %s', (status, reason) => {
		expect(classifyAttachmentSendError(withStatus(status), false)).toBe(
			reason
		);
	});

	it('reads Synapse M_TOO_LARGE as too large for the server', () => {
		expect(
			classifyAttachmentSendError(
				Object.assign(new Error('x'), { errcode: 'M_TOO_LARGE' }),
				false
			)
		).toBe('serverTooLarge');
	});

	it.each([
		['ConnectionError', 'request failed'],
		['Error', 'Timeout'],
		['TypeError', 'Failed to fetch']
	])('reads %s "%s" as a lost connection', (name, message) => {
		expect(
			classifyAttachmentSendError(
				Object.assign(new Error(message), { name }),
				false
			)
		).toBe('network');
	});

	it('separates a token service failure from a lost connection', () => {
		const token = (cause: Error) =>
			Object.assign(new Error('token'), {
				name: 'MatrixTokenUnavailableError',
				cause
			});

		expect(
			classifyAttachmentSendError(token(new Error('CATCH_ALL')), false)
		).toBe('service');
		expect(
			classifyAttachmentSendError(
				token(new TypeError('Failed to fetch')),
				false
			)
		).toBe('network');
	});

	it('does not invent a cause for anything else', () => {
		expect(classifyAttachmentSendError(new Error('x'), false)).toBe(
			'other'
		);
		expect(classifyAttachmentSendError(undefined, false)).toBe('other');
	});
});

describe('canRetryAttachment', () => {
	it('offers no retry where the same file cannot work', () => {
		expect(canRetryAttachment('tooLarge')).toBe(false);
		expect(canRetryAttachment('format')).toBe(false);
		expect(canRetryAttachment('network')).toBe(true);
		expect(canRetryAttachment('serverTooLarge')).toBe(true);
	});
});
