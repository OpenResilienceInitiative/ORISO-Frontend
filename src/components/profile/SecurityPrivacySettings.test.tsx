// @vitest-environment jsdom
import * as React from 'react';
import { createContext, useState } from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
vi.mock('./DeleteAccount', () => ({
	DeleteAccount: () => <button>Delete account</button>
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
const view = (role: string, twoFactorEnabled = true) => (
	<UserDataContext.Provider
		value={
			{
				userData: {
					grantedAuthorities: [role],
					twoFactorAuth: { isEnabled: twoFactorEnabled }
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
	});

	it('keeps account deletion in asker privacy without exposing the consultant editor', () => {
		render(view('asker'));
		const privacy = screen.getByRole('region', {
			name: 'profile.securityPrivacy.privacy.title'
		});
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
