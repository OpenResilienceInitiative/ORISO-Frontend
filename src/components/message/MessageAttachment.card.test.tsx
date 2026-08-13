// @vitest-environment jsdom
/**
 * #994 — the four attachment states (plain, encrypted, awaiting media check,
 * blocked) used to build their own markup with their own inline styles, so
 * the same file looked different depending on encryption and scan state.
 * These tests hold them to one shared card.
 */
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessageAttachment } from './MessageAttachment';
import { NotificationsContext } from '../../globalState';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			options?.name ? `${key}:${options.name}` : key
	})
}));
vi.mock('../../resources/scripts/endpoints', () => ({
	apiUrl: 'https://api.test'
}));
vi.mock('../../globalState', () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const react = require('react');
	return {
		NotificationsContext: react.createContext({
			addNotification: () => {}
		}),
		NOTIFICATION_TYPE_ERROR: 'error'
	};
});

const pdfAttachment = {
	title: 'report.pdf',
	downloadUrl: '/_matrix/media/r0/download/hs/media-1',
	type: 'file',
	size: 1200
} as never;

const imageAttachment = {
	title: 'photo.png',
	downloadUrl: '/_matrix/media/r0/download/hs/media-2',
	type: 'image',
	size: 12,
	width: 120,
	height: 72
} as never;

const renderAttachment = (
	attachment: never,
	file: never,
	extraProps: Record<string, unknown> = {}
) =>
	render(
		<NotificationsContext.Provider
			value={{ addNotification: vi.fn() } as never}
		>
			<MessageAttachment
				attachment={attachment}
				file={file}
				hasRenderedMessage
				rid="room-1"
				// eslint-disable-next-line react/jsx-props-no-spreading
				{...extraProps}
			/>
		</NotificationsContext.Provider>
	);

const pdfFile = { name: 'report.pdf', type: 'application/pdf' } as never;
const imageFile = { name: 'photo.png', type: 'image/png' } as never;

describe('MessageAttachment card states (#994)', () => {
	afterEach(() => cleanup());

	it('uses the shared card for a plain download', () => {
		const { container } = renderAttachment(pdfAttachment, pdfFile);

		const card = container.querySelector('.attachmentCard');
		expect(card).not.toBeNull();
		expect(card?.tagName).toBe('A');
		expect(card?.getAttribute('style')).toBeNull();
	});

	it('uses the same card, without a link, for blocked media', () => {
		const { container } = renderAttachment(imageAttachment, imageFile, {
			mediaCheckState: 'blocked'
		});

		const card = container.querySelector('.attachmentCard');
		expect(card).not.toBeNull();
		expect(card?.tagName).not.toBe('A');
		expect(card?.className).toContain('attachmentCard--blocked');
	});

	it('uses the same card, still unlinked, while media is unchecked', () => {
		const { container } = renderAttachment(imageAttachment, imageFile, {
			mediaCheckState: 'unchecked'
		});

		expect(container.querySelector('.attachmentCard')).not.toBeNull();
		expect(container.querySelector('a')).toBeNull();
		expect(
			screen.getByRole('button', {
				name: 'attachments.mediaCheck.reveal'
			})
		).toBeTruthy();
	});

	it('names the download action after the file, for screen readers', () => {
		renderAttachment(pdfAttachment, pdfFile);

		expect(
			screen.getByRole('link', {
				name: 'attachments.download.aria:report.pdf'
			})
		).toBeTruthy();
	});

	it('leaves no inline-styled attachment markup behind in any state', () => {
		const states = ['safe', 'unchecked', 'blocked'] as const;
		states.forEach((mediaCheckState) => {
			const { container, unmount } = renderAttachment(
				imageAttachment,
				imageFile,
				{ mediaCheckState }
			);
			container
				.querySelectorAll('.attachmentCard')
				.forEach((card) =>
					expect(card.getAttribute('style')).toBeNull()
				);
			unmount();
		});
	});
});
