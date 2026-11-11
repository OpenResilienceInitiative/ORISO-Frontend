// @vitest-environment oriso-jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import type { IUserDraftItem } from '../../api/apiUserDrafts';
import { DraftsCenter } from './DraftsCenter';

const mocks = vi.hoisted(() => ({
	drafts: [] as IUserDraftItem[],
	identity: null as string | null,
	untilL: false,
	navigate: vi.fn(),
	remove: vi.fn(),
	register: vi.fn(() => () => {})
}));

vi.mock('react-router-dom', () => ({
	useNavigate: () => mocks.navigate,
	Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	)
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ untilL: mocks.untilL })
}));
vi.mock('../../hooks/useRemoteDrafts', () => ({
	useRemoteDrafts: () => mocks.drafts
}));
vi.mock('../../api/apiUserDrafts', () => ({
	apiDeleteUserDraft: mocks.remove
}));
vi.mock('../../services/draftCryptographyWindow', () => ({
	getDraftAuthSessionIdentity: () => mocks.identity,
	getDraftCryptographyForWindow: () => null,
	subscribeDraftCryptographyForWindow: () => () => {},
	registerDraftCryptographyFrame: mocks.register
}));

const opaque = 'draft.v1.' + 'a'.repeat(43);
const draft: IUserDraftItem = {
	scopeKey: 'scope:!room:x|thread:main',
	opaqueScopeKey: opaque,
	text: '<p>A synthetic draft</p>',
	actionPath: '/sessions/user/view/session/12?draftScopeKey=legacy'
};

afterEach(() => {
	cleanup();
	mocks.drafts = [];
	mocks.identity = null;
	mocks.untilL = false;
	vi.clearAllMocks();
});

it('registers the actual desktop frame and opens or deletes by opaque scope', () => {
	mocks.drafts = [draft];
	render(<DraftsCenter />);

	const frame = screen.getByTitle('drafts.center.embeddedTitle');
	expect(mocks.register).toHaveBeenCalledWith(frame);
	expect(frame.getAttribute('src')).toBe(
		`/sessions/user/view/session/12?draftScopeKey=${opaque}&embeddedNotifications=1`
	);
	fireEvent.click(screen.getByRole('button', { name: 'drafts.center.open' }));
	expect(mocks.navigate).toHaveBeenCalledWith(
		`/sessions/user/view/session/12?draftScopeKey=${opaque}`
	);
	fireEvent.click(
		screen.getByRole('button', { name: 'drafts.center.delete' })
	);
	expect(mocks.remove).toHaveBeenCalledWith(opaque);
});

it('does not fall back to a raw scope when tapping an old draft on mobile', () => {
	mocks.untilL = true;
	mocks.drafts = [{ ...draft, opaqueScopeKey: undefined }];
	render(<DraftsCenter />);
	expect(screen.queryByTitle('drafts.center.embeddedTitle')).toBeNull();
	fireEvent.click(screen.getByRole('button', { name: /A synthetic draft/ }));
	expect(mocks.navigate).not.toHaveBeenCalled();
});

it('offers the existing security recovery route when the signed-in drafts are locked', () => {
	mocks.identity = 'signed-in-owner';
	render(<DraftsCenter />);
	expect(
		screen
			.getByRole('link', { name: 'profile.encryption.recover.cta' })
			.getAttribute('href')
	).toBe('/profile/einstellungen/sicherheit');
	expect(screen.queryByText('drafts.center.empty')).toBeNull();
});
