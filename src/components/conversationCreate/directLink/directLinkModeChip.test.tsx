// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { GuestAccountMode } from '../../guestAccountMode/guestAccountMode';
import { DirectLink } from './directLink';
import { DirectLinkShareDialog } from './DirectLinkShareDialog';
import { MyDirectLinks } from './MyDirectLinks';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('qrcode', () => ({
	default: { toDataURL: vi.fn(() => Promise.resolve('data:image/png,')) }
}));

const linkWith = (
	guestAccountMode: GuestAccountMode | undefined,
	temporary: boolean
): DirectLink => ({
	id: '1',
	name: 'Sucht',
	topic: 'Sucht',
	medium: 'VIDEO',
	temporary,
	guestAccountMode,
	active: true,
	url: 'https://example.test/l/1'
});

const chips = (container: HTMLElement) =>
	Array.from(container.querySelectorAll('.directLinkChip')).map(
		(chip) => chip.textContent
	);

const renderList = (link: DirectLink) =>
	render(
		<MyDirectLinks links={[link]} onToggle={vi.fn()} onShowQr={vi.fn()} />
	).container;

const renderDialog = (link: DirectLink) => {
	render(<DirectLinkShareDialog open link={link} onClose={vi.fn()} />);
	return document.body;
};

afterEach(cleanup);

describe.each([
	['list', renderList],
	['share dialog', renderDialog]
])('UserService#1662: the account chip in the %s', (_, renderLink) => {
	it('says "Temporär" only for TEMPORARY', () => {
		expect(chips(renderLink(linkWith('TEMPORARY', true)))).toEqual([
			'directLink.temporary'
		]);
	});

	it('says "Gast wählt" for GUEST_CHOOSES', () => {
		expect(chips(renderLink(linkWith('GUEST_CHOOSES', true)))).toEqual([
			'guestAccountMode.option.GUEST_CHOOSES'
		]);
	});

	it('shows no chip for PERMANENT', () => {
		expect(chips(renderLink(linkWith('PERMANENT', false)))).toEqual([]);
	});

	it('reads a link from an older server like the backend does (temporary on → guest chooses)', () => {
		expect(chips(renderLink(linkWith(undefined, true)))).toEqual([
			'guestAccountMode.option.GUEST_CHOOSES'
		]);
	});
});
