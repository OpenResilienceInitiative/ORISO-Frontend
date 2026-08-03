import { describe, expect, it } from 'vitest';
import { buildMatrixActivityTextPreview } from './matrixActivityPreview';

describe('buildMatrixActivityTextPreview', () => {
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

	it('keeps the localized generic copy when no decrypted text is available', () => {
		expect(
			buildMatrixActivityTextPreview(
				{ status: 'pending-decryption', event: {} } as any,
				'Lisa',
				'New message'
			)
		).toBe('New message');
	});
});
