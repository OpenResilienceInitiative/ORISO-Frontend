import { describe, expect, it } from 'vitest';
import {
	buildMatrixActivityTextPreview,
	getMatrixActivityPreviewKind
} from './matrixActivityPreview';

describe('buildMatrixActivityTextPreview', () => {
	const labels = {
		image: 'Image',
		file: 'File',
		audio: 'Audio message',
		video: 'Video',
		notice: 'Notice',
		unsupported: 'Unsupported message',
		pending: 'Waiting for decryption',
		roomUnavailable: 'Conversation unavailable on this device',
		eventUnavailable: 'Message unavailable in local history'
	};
	it('renders the sender and normalized plain-text body of the resolved event', () => {
		const event = {
			getType: () => 'm.room.message',
			getContent: () => ({
				body: 'First line\n\nSecond   line',
				format: 'org.matrix.custom.html',
				formatted_body: '<strong>must not be rendered</strong>'
			})
		};

		expect(
			buildMatrixActivityTextPreview(
				{ status: 'resolved', event } as any,
				'Lisa',
				'New message'
			)
		).toBe('Lisa: First line Second line');
	});

	it('uses the Matrix edit replacement body when present', () => {
		const event = {
			getType: () => 'm.room.message',
			getContent: () => ({
				'body': '* old text',
				'm.new_content': { body: 'corrected text' }
			})
		};

		expect(
			buildMatrixActivityTextPreview(
				{ status: 'resolved', event } as any,
				'Lisa',
				'New message'
			)
		).toBe('Lisa: corrected text');
	});

	it.each([
		['pending-decryption', 'Waiting for decryption'],
		['room-unavailable', 'Conversation unavailable on this device'],
		['event-unavailable', 'Message unavailable in local history']
	])('uses an explicit localized %s fallback', (status, expected) => {
		const resolution =
			status === 'pending-decryption'
				? { status, event: {} }
				: { status };

		expect(
			buildMatrixActivityTextPreview(
				resolution as any,
				'Lisa',
				'New message',
				labels
			)
		).toBe(expected);
	});

	it.each([
		['m.image', 'Image', 'image'],
		['m.file', 'File', 'file'],
		['m.audio', 'Audio message', 'audio'],
		['m.video', 'Video', 'video'],
		['m.notice', 'Notice', 'notice']
	])('uses a safe localized label for %s', (msgtype, expected, kind) => {
		const event = {
			getType: () => 'm.room.message',
			getContent: () => ({
				msgtype,
				body: 'sensitive filename or notice body',
				url: 'mxc://secret',
				file: { key: { k: 'secret-key' } }
			})
		};

		const preview = buildMatrixActivityTextPreview(
			{ status: 'resolved', event } as any,
			'Lisa',
			'New message',
			labels
		);

		expect(preview).toBe(`Lisa: ${expected}`);
		expect(preview).not.toContain('sensitive');
		expect(preview).not.toContain('mxc://');
		expect(preview).not.toContain('secret-key');
		expect(
			getMatrixActivityPreviewKind({ status: 'resolved', event } as any)
		).toBe(kind);
	});

	it('falls back safely for an unsupported Matrix message type', () => {
		const event = {
			getType: () => 'm.room.message',
			getContent: () => ({ msgtype: 'm.location', body: 'private place' })
		};

		expect(
			buildMatrixActivityTextPreview(
				{ status: 'resolved', event } as any,
				'Lisa',
				'New message',
				labels
			)
		).toBe('Lisa: Unsupported message');
		expect(
			getMatrixActivityPreviewKind({ status: 'resolved', event } as any)
		).toBe('unsupported');
	});
});
