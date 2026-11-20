// @vitest-environment oriso-jsdom
import * as React from 'react';
import { createContext, useState } from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { UserDataContext } from '../../globalState';
import { SecurityPrivacySettings } from './SecurityPrivacySettings';

vi.mock('../../globalState', () => ({
	UserDataContext: createContext(null),
	AUTHORITIES: { CONSULTANT_DEFAULT: 'consultant', ASKER_DEFAULT: 'asker' },
	hasUserAuthority: (
		authority: string,
		user: { grantedAuthorities?: string[] }
	) => !!user.grantedAuthorities?.includes(authority)
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../passwordReset/PasswordReset', () => ({
	PasswordReset: () => <button>Password</button>
}));
vi.mock('../twoFactorAuth/TwoFactorAuth', () => ({
	TwoFactorAuth: () => <button>Two factor</button>
}));
vi.mock('./DisplayNameSettings', () => ({
	DisplayNameSettings: () => <button>Display name</button>
}));
vi.mock('./AskerDisplayNameSettings', () => ({
	AskerDisplayNameSettings: () => <button>Asker display names</button>
}));
vi.mock('./DeleteAccount', () => ({
	DeleteAccount: () => <button>Delete account</button>
}));
vi.mock('../temporaryAccount/KeepAccountEntry', () => ({
	KeepAccountEntry: () => <button>Keep account</button>,
	isKeepableTemporaryAccount: (user?: {
		temporaryAccount?: boolean;
		temporaryAccountKeepAllowed?: boolean;
	}) => Boolean(user?.temporaryAccount && user.temporaryAccountKeepAllowed)
}));
vi.mock('./EncryptionSettings', () => ({
	EncryptionSettingsPanel: () => {
		const [step, setStep] = useState(0);
		return (
			<button onClick={() => setStep(step + 1)}>
				Recovery step {step}
			</button>
		);
	}
}));

afterEach(cleanup);
const view = (
	role: string,
	twoFactorEnabled = true,
	temporaryAccount?: boolean,
	temporaryAccountKeepAllowed = temporaryAccount
) => (
	<UserDataContext.Provider
		value={
			{
				userData: {
					grantedAuthorities: [role],
					twoFactorAuth: { isEnabled: twoFactorEnabled },
					temporaryAccount,
					temporaryAccountKeepAllowed
				}
			} as never
		}
	>
		<SecurityPrivacySettings />
	</UserDataContext.Provider>
);

describe('Security and privacy groups', () => {
	it('keeps the three groups in reading order and controls within their group', () => {
		render(view('consultant'));
		expect(
			screen
				.getAllByRole('heading', { level: 2 })
				.map((node) => node.textContent)
		).toEqual([
			'profile.securityPrivacy.account.title',
			'profile.securityPrivacy.recovery.title',
			'profile.securityPrivacy.privacy.title'
		]);
		const account = screen.getByRole('region', {
			name: 'profile.securityPrivacy.account.title'
		});
		const recovery = screen.getByRole('region', {
			name: 'profile.securityPrivacy.recovery.title'
		});
		const privacy = screen.getByRole('region', {
			name: 'profile.securityPrivacy.privacy.title'
		});
		expect(
			within(account).getByRole('button', { name: 'Password' })
		).toBeTruthy();
		expect(
			within(account).getByRole('button', { name: 'Two factor' })
		).toBeTruthy();
		expect(
			within(recovery).getByRole('button', { name: 'Recovery step 0' })
		).toBeTruthy();
		expect(
			within(privacy).getByRole('button', { name: 'Display name' })
		).toBeTruthy();
		expect(
			within(privacy).queryByRole('button', { name: 'Delete account' })
		).toBeNull();
		expect(
			within(privacy).queryByRole('button', {
				name: 'Asker display names'
			})
		).toBeNull();
	});

	it('keeps account deletion in asker privacy without exposing the consultant editor', () => {
		render(view('asker'));
		const privacy = screen.getByRole('region', {
			name: 'profile.securityPrivacy.privacy.title'
		});
		// #2175: askers see and edit their per-conversation display names.
		expect(
			within(privacy).getByRole('button', { name: 'Asker display names' })
		).toBeTruthy();
		expect(
			within(privacy).getByRole('button', { name: 'Delete account' })
		).toBeTruthy();
		expect(
			screen.queryByRole('button', { name: 'Display name' })
		).toBeNull();
	});

	it.each(['consultant', 'unknown'])(
		'does not expose asker deletion to %s',
		(role) => {
			render(view(role));
			expect(
				screen.queryByRole('button', { name: 'Delete account' })
			).toBeNull();
		}
	);

	describe('a temporary account (UserService#1662)', () => {
		it('offers to keep the account and hides the display names', () => {
			render(view('asker', true, true));
			const account = screen.getByRole('region', {
				name: 'profile.securityPrivacy.account.title'
			});
			expect(
				within(account).getByRole('button', { name: 'Keep account' })
			).toBeTruthy();
			expect(
				screen.queryByRole('button', { name: 'Asker display names' })
			).toBeNull();
			// Deleting stays possible.
			expect(
				screen.getByRole('button', { name: 'Delete account' })
			).toBeTruthy();
		});

		it('offers no password change: the account has no password of its own yet', () => {
			render(view('asker', true, true));
			expect(
				screen.queryByRole('button', { name: 'Password' })
			).toBeNull();
		});

		it('shows no empty sign-in group when there is neither a keep card nor two-factor', () => {
			render(view('asker', false, true, false));
			expect(
				screen.queryByRole('region', {
					name: 'profile.securityPrivacy.account.title'
				})
			).toBeNull();
			expect(
				screen.getByRole('region', {
					name: 'profile.securityPrivacy.recovery.title'
				})
			).toBeTruthy();
		});

		it('offers no keep card when the server will not let it keep', () => {
			render(view('asker', true, true, false));
			expect(
				screen.queryByRole('button', { name: 'Keep account' })
			).toBeNull();
			expect(
				screen.queryByRole('button', { name: 'Password' })
			).toBeNull();
		});

		it('shows the display names again and no keep offer once the account is kept', () => {
			render(view('asker', true, false));
			expect(
				screen.queryByRole('button', { name: 'Keep account' })
			).toBeNull();
			expect(
				screen.getByRole('button', { name: 'Asker display names' })
			).toBeTruthy();
			expect(
				screen.getByRole('button', { name: 'Password' })
			).toBeTruthy();
		});
	});

	it('retains the two-factor availability condition', () => {
		render(view('asker', false));
		expect(screen.queryByRole('button', { name: 'Two factor' })).toBeNull();
	});

	it('keeps an in-progress recovery flow when the parent rerenders', () => {
		const { rerender } = render(view('asker'));
		fireEvent.click(
			screen.getByRole('button', { name: 'Recovery step 0' })
		);
		rerender(view('asker'));
		expect(
			screen.getByRole('button', { name: 'Recovery step 1' })
		).toBeTruthy();
	});
});
