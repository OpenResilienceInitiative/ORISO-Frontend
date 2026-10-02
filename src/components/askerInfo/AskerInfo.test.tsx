// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AskerInfo } from './AskerInfo';
import { SessionTypeContext } from '../../globalState';

// lottie-web (pulled in transitively) touches canvas at import time and jsdom
// has no 2d context.
HTMLCanvasElement.prototype.getContext = (() => ({
	fillRect: () => undefined,
	fillStyle: ''
})) as never;

const ASKER_MATRIX_ID = '@schildkrote-hedi:matrix.oriso.org';
const USERNAME = 'schildkrote_hedi_5707';

const buildSession = (askerMatrixUserId?: string) => ({
	item: {
		id: 3363,
		matrixRoomId: '!room:matrix.oriso.org',
		askerMatrixUserId
	},
	user: { username: USERNAME },
	isGroup: false
});
const useSessionMock = vi.fn(() => ({
	session: buildSession(ASKER_MATRIX_ID),
	ready: true
}));
const generateAvatarForUserMock = vi.fn((userId: string) => ({
	file: `${userId}.svg`,
	bg: '#eee',
	iconColor: '#111'
}));

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../hooks/useSession', () => ({
	useSession: () => useSessionMock()
}));
vi.mock('../../hooks/useSearchParams', () => ({ useSearchParam: () => null }));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ fromL: true, fromM: true, untilL: false })
}));
vi.mock('../app/navigationHandler', () => ({
	desktopView: vi.fn(),
	mobileListView: vi.fn(),
	mobileUserProfileView: vi.fn()
}));
vi.mock('./AskerInfoContent', () => ({
	AskerInfoContent: () => <div data-testid="asker-info-content" />
}));
vi.mock('./AskerInfoFooter', () => ({
	AskerInfoFooter: () => <div data-testid="asker-info-footer" />
}));
// The generic person glyph the profile body used to show (#1188 job 3). It is
// still the header's decorative pill icon, so the assertions below distinguish
// the two by their aria state rather than by presence alone.
vi.mock('../../resources/img/icons/person.svg', () => ({
	ReactComponent: () => <svg data-testid="person-icon" />
}));
vi.mock('../pseudonym/AnimalAvatar', () => ({
	AnimalAvatar: ({
		avatar,
		size
	}: {
		avatar: { file: string };
		size: number;
	}) => (
		<span
			data-testid="animal-avatar"
			data-avatar-file={avatar.file}
			data-size={String(size)}
		/>
	)
}));
vi.mock('../../utils/pseudonymGenerator', () => ({
	generateAvatarForUser: (userId: string) => generateAvatarForUserMock(userId)
}));

const renderProfile = () =>
	render(
		<MemoryRouter>
			<SessionTypeContext.Provider
				value={{ path: '/sessions/consultant/sessionView' } as never}
			>
				<AskerInfo />
			</SessionTypeContext.Provider>
		</MemoryRouter>
	);

describe('AskerInfo (#1188 job 3: the asker profile shows their animal)', () => {
	afterEach(cleanup);

	it('renders the animal avatar for the advice seeker', () => {
		renderProfile();
		expect(screen.getByTestId('animal-avatar')).toBeTruthy();
	});

	it('keys the animal on the Matrix user id, like the session list does', () => {
		renderProfile();
		// SessionListItemComponent derives the same way, so profile, list and
		// chat agree on one animal per asker.
		expect(generateAvatarForUserMock).toHaveBeenCalledWith(ASKER_MATRIX_ID);
		expect(screen.getByTestId('animal-avatar').dataset.avatarFile).toBe(
			`${ASKER_MATRIX_ID}.svg`
		);
	});

	it('falls back to the username when the session carries no Matrix user id', () => {
		useSessionMock.mockReturnValueOnce({
			session: buildSession(undefined),
			ready: true
		});
		renderProfile();
		expect(generateAvatarForUserMock).toHaveBeenCalledWith(USERNAME);
	});

	it('gives the avatar an accessible name instead of leaving it a bare span', () => {
		renderProfile();
		const avatar = screen.getByRole('img', {
			name: 'profile.data.profileIcon'
		});
		expect(avatar.className).toContain('askerInfo__icon');
		expect(
			avatar.querySelector('[data-testid="animal-avatar"]')
		).toBeTruthy();
	});

	it('keeps the person glyph decorative in the header pill only', () => {
		renderProfile();
		// The header pill may keep the glyph, but it must stay hidden from AT
		// and must not be the profile body avatar.
		const glyphs = screen.queryAllByTestId('person-icon');
		glyphs.forEach((glyph) => {
			expect(glyph.closest('[aria-hidden="true"]')).not.toBeNull();
		});
	});
});
