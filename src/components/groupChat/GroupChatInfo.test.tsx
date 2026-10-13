// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	desktopView,
	mobileDetailView,
	mobileListView
} from '../app/navigationHandler';
import { GroupChatInfo } from './GroupChatInfo';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

// The globalState barrel pulls lottie-web (crashes in jsdom); stub what the
// info view reads before its session has loaded.
vi.mock('../../globalState', async () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const react = require('react');
	return {
		AUTHORITIES: {},
		hasUserAuthority: () => false,
		useTenant: () => ({ settings: {} }),
		UserDataContext: react.createContext({ userData: {} }),
		SessionTypeContext: react.createContext({ path: '/sessions' }),
		ActiveSessionContext: react.createContext({}),
		ActiveSessionProvider: ({ children }: any) => children
	};
});

vi.mock('../app/navigationHandler', () => ({
	desktopView: vi.fn(),
	mobileDetailView: vi.fn(),
	mobileListView: vi.fn()
}));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ fromL: false })
}));
vi.mock('../../hooks/useSession', () => ({
	useSession: () => ({ session: null, ready: false })
}));
vi.mock('../../hooks/useAppConfig', () => ({ useAppConfig: () => ({}) }));

const renderInfo = (props: { dialog?: boolean }) =>
	render(
		<MemoryRouter>
			<GroupChatInfo {...props} />
		</MemoryRouter>
	);

describe('GroupChatInfo mobile navigation', () => {
	beforeEach(() => vi.clearAllMocks());
	afterEach(cleanup);

	it('switches the mobile layout to the detail pane as a standalone page', () => {
		const { unmount } = renderInfo({});
		expect(mobileDetailView).toHaveBeenCalledTimes(1);

		unmount();
		expect(mobileListView).toHaveBeenCalledTimes(1);
	});

	it('leaves the mobile layout to the session underneath when shown as a dialog', () => {
		const { unmount } = renderInfo({ dialog: true });
		unmount();

		expect(mobileDetailView).not.toHaveBeenCalled();
		expect(mobileListView).not.toHaveBeenCalled();
		expect(desktopView).not.toHaveBeenCalled();
	});
});
