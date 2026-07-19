// @vitest-environment jsdom

import * as React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState';
import { TwoFactorAuth } from './TwoFactorAuth';

const setupDialogMock = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('react-router-dom', () => ({
	useLocation: () => ({
		state: { openTwoFactor: true }
	})
}));

vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({
		twofactor: { dateTwoFactorObligatory: new Date(0) }
	})
}));

vi.mock('../../globalState', async () => {
	const ReactModule = await import('react');

	return {
		UserDataContext: ReactModule.createContext(undefined)
	};
});

vi.mock('../button/Button', () => ({
	BUTTON_TYPES: { LINK_INLINE: 'LINK_INLINE' },
	Button: () => null
}));
vi.mock('../headline/Headline', () => ({ Headline: () => null }));
vi.mock('../Switch', () => ({ Switch: () => null }));
vi.mock('../text/Text', () => ({ Text: () => null }));
vi.mock('../../resources/img/icons', () => ({ PenIcon: () => null }));
vi.mock('./twoFactorAuth.styles', () => ({}));
vi.mock('./TwoFactorSetupDialog', () => ({
	TwoFactorSetupDialog: (props: unknown) => {
		setupDialogMock(props);
		return null;
	}
}));

describe('TwoFactorAuth', () => {
	beforeEach(() => {
		setupDialogMock.mockClear();
	});

	it('keeps mandatory two-factor authentication setup dismissible', () => {
		const contextValue = {
			userData: {
				email: 'consultant@example.org',
				twoFactorAuth: {
					isActive: true,
					type: 'APP'
				}
			},
			reloadUserData: vi.fn()
		} as React.ContextType<typeof UserDataContext>;

		render(
			<UserDataContext.Provider value={contextValue}>
				<TwoFactorAuth />
			</UserDataContext.Provider>
		);

		expect(setupDialogMock).toHaveBeenLastCalledWith(
			expect.objectContaining({
				canDisable: true,
				canClose: true,
				open: true
			})
		);
	});
});
