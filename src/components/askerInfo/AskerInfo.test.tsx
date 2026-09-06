// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AskerInfo } from './AskerInfo';
import { SessionTypeContext } from '../../globalState';

const mockSession = {
	item: {
		id: 3363,
		matrixRoomId: '!room:matrix.oriso.org',
		askerMatrixUserId: '@schildkrote-hedi:matrix.oriso.org'
	},
	user: { username: 'schildkrote_hedi_5707' },
	isGroup: false
};
const useSessionMock = vi.fn(() => ({ session: mockSession, ready: true }));

// lottie-web (pulled in transitively) touches canvas at import time and jsdom
// has no 2d context; a stub keeps this profile test independent of it.
HTMLCanvasElement.prototype.getContext = (() => ({
	fillRect: () => undefined,
	fillStyle: ''
})) as never;
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../hooks/useSession', () => ({
	useSession: () => useSessionMock()
}));
vi.mock('../../hooks/useSearchParams', () => ({ useSearchParam: () => null }));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ fromL: true, untilL: false })
}));
vi.mock('../app/navigationHandler', () => ({
	desktopView: vi.fn(),
	mobileListView: vi.fn(),
	mobileUserProfileView: vi.fn()
}));
vi.mock('../message/UserAvatar', () => ({
	UserAvatar: ({ userId, size }: { userId: string; size?: string }) => (
		<span
			data-testid="user-avatar"
			data-user-id={userId}
			data-size={size}
		/>
	)
}));
vi.mock('./AskerInfoContent', () => ({
	AskerInfoContent: () => <div data-testid="asker-info-content" />
}));
vi.mock('../../resources/img/icons/arrow-left.svg', () => ({
	ReactComponent: () => <svg data-testid="back-icon" />
}));
// The generic person glyph this profile used to show (#1188 job 3).
vi.mock('../../resources/img/icons/person.svg', () => ({
	ReactComponent: () => <svg data-testid="person-icon" />
}));
vi.mock('../../utils/pseudonymGenerator', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../utils/pseudonymGenerator')>();
	return {
		...actual,
		renderAvatarSvg: vi.fn(() => Promise.resolve('<svg/>'))
	};
});

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

describe('AskerInfo (#1188 job 3: animal avatar instead of a person glyph)', () => {
	afterEach(cleanup);

	it('renders the shared avatar component, not the generic person glyph', () => {
		renderProfile();
		expect(screen.getByTestId('user-avatar')).toBeTruthy();
		expect(screen.queryByTestId('person-icon')).toBeNull();
	});

	it('keys the avatar on the Matrix user id, like the session list does', () => {
		renderProfile();
		// Same derivation as SessionListItemComponent: askerMatrixUserId first,
		// so the profile shows the animal the list and the chat already show.
		expect(screen.getByTestId('user-avatar').dataset.userId).toBe(
			'@schildkrote-hedi:matrix.oriso.org'
		);
	});

	it('falls back to the username when the session has no Matrix user id', () => {
		useSessionMock.mockReturnValueOnce({
			session: {
				...mockSession,
				item: { ...mockSession.item, askerMatrixUserId: undefined }
			},
			ready: true
		} as any);
		renderProfile();
		expect(screen.getByTestId('user-avatar').dataset.userId).toBe(
			'schildkrote_hedi_5707'
		);
	});

	it('renders the avatar at the profile size', () => {
		renderProfile();
		expect(screen.getByTestId('user-avatar').dataset.size).toBe('72px');
	});
});
