// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { DirectLinkShareDialog } from './DirectLinkShareDialog';
import type { DirectLink } from './directLink';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('qrcode', () => ({
	default: { toDataURL: () => Promise.resolve('data:image/png;base64,') }
}));

const base: DirectLink = {
	id: '1',
	name: 'Flyer',
	topic: 'Schulden',
	medium: 'VIDEO',
	temporary: true,
	active: true,
	url: 'https://app.example/invite/abc'
};

afterEach(cleanup);

/* #2252: the description says who meets in which conversation. */
describe('DirectLinkShareDialog', () => {
	it.each([
		['a plain direct link', base, 'directLink.share.description'],
		[
			'an invitation with an appointment',
			{
				...base,
				appointment: {
					id: 'a',
					start: '2026-11-20T13:00:00Z',
					end: '2026-11-20T14:00:00Z'
				}
			},
			'directLink.share.descriptionAppointment'
		],
		[
			'an invitation into an existing 1:1',
			{
				...base,
				joinsExistingSession: true,
				appointment: {
					id: 'a',
					start: '2026-11-20T13:00:00Z',
					end: '2026-11-20T14:00:00Z'
				}
			},
			'directLink.share.descriptionJoin'
		]
	])('describes %s', (_name, link, key) => {
		render(<DirectLinkShareDialog open link={link} onClose={vi.fn()} />);
		expect(screen.getByText(key)).toBeTruthy();
	});
});
