// @vitest-environment jsdom
/**
 * WP-4 media check states (epic ORISO-Admin#366): images from anonymous
 * live-chat guests render blurred until the counsellor reveals them, blocked
 * media never renders, and inline display can be switched off per chat type
 * (media then arrives as a plain file card).
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessageAttachment } from './MessageAttachment';
import { NotificationsContext } from '../../globalState';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../resources/scripts/endpoints', () => ({
	apiUrl: 'https://api.test'
}));
// The globalState barrel transitively pulls lottie-web (crashes in jsdom), so
// mock it down to just what MessageAttachment consumes.
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

const imageAttachment = {
	title: 'photo.png',
	title_link: '/_matrix/media/r0/download/hs/media-1',
	type: 'image',
	image_type: 'image/png',
	image_size: 12,
	image_url: '/_matrix/media/r0/download/hs/media-1',
	image_w: 120,
	image_h: 72
} as never;

const imageFile = { name: 'photo.png', type: 'image/png' } as never;

const renderAttachment = (extraProps: Record<string, unknown> = {}) =>
	render(
		<NotificationsContext.Provider
			value={{ addNotification: vi.fn() } as never}
		>
			<MessageAttachment
				attachment={imageAttachment}
				file={imageFile}
				hasRenderedMessage
				rid="room-1"
				// eslint-disable-next-line react/jsx-props-no-spreading
				{...extraProps}
			/>
		</NotificationsContext.Provider>
	);

describe('MessageAttachment media check states', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders a safe image scaled via its intrinsic aspect ratio', () => {
		renderAttachment({ mediaCheckState: 'safe' });

		const img = screen.getByRole('img');
		expect(img.getAttribute('src')).toContain('media-1');
		expect(
			screen.queryByRole('button', {
				name: 'attachments.mediaCheck.reveal'
			})
		).toBeNull();
	});

	it('blurs unchecked guest images until the counsellor reveals them', () => {
		renderAttachment({ mediaCheckState: 'unchecked' });

		const preview = document.querySelector(
			'.messageItem__message__attachment__preview--blurred'
		);
		expect(preview).not.toBeNull();

		fireEvent.click(
			screen.getByRole('button', {
				name: 'attachments.mediaCheck.reveal'
			})
		);

		expect(
			document.querySelector(
				'.messageItem__message__attachment__preview--blurred'
			)
		).toBeNull();
		expect(screen.getByRole('img')).toBeTruthy();
	});

	it('renders a blocked tile without image or download link', () => {
		renderAttachment({ mediaCheckState: 'blocked' });

		expect(screen.queryByRole('img')).toBeNull();
		expect(document.querySelector('a')).toBeNull();
		expect(screen.getByText('attachments.mediaCheck.blocked')).toBeTruthy();
	});

	it('falls back to a plain file card when inline display is off', () => {
		renderAttachment({
			mediaCheckState: 'safe',
			inlineDisplayEnabled: false
		});

		expect(screen.queryByRole('img')).toBeNull();
		// still downloadable as a file
		expect(document.querySelector('a')).not.toBeNull();
		expect(screen.getByText('photo.png')).toBeTruthy();
	});
});
