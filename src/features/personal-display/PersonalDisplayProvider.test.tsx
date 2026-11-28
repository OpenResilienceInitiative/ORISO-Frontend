// @vitest-environment jsdom
import * as React from 'react';
import { webcrypto } from 'node:crypto';
import {
	act,
	cleanup,
	render,
	screen,
	waitFor,
	fireEvent
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import {
	PersonalDisplayProvider,
	usePersonalDisplayHost
} from './PersonalDisplayProvider';

const account = vi.hoisted(() => ({ identity: 'A' }));
vi.mock('../../utils/authenticatedTenant', () => ({
	getAuthenticatedPreferenceIdentity: () => account.identity,
	subscribeToAuthenticatedTenant: (listener: () => void) => {
		window.addEventListener('test-auth', listener);
		return () => window.removeEventListener('test-auth', listener);
	}
}));

const query = {
	matches: false,
	addEventListener: (type: string, listener: EventListener) =>
		window.addEventListener(type + '-fixture', listener),
	removeEventListener: (type: string, listener: EventListener) =>
		window.removeEventListener(type + '-fixture', listener)
};

const changeSystemScheme = (dark: boolean) => {
	act(() => {
		query.matches = dark;
		window.dispatchEvent(new Event('change-fixture'));
	});
};
const changeAccount = (identity: string) => {
	act(() => {
		account.identity = identity;
		window.dispatchEvent(new Event('test-auth'));
	});
};

const Probe = ({ active = true }: { active?: boolean }) => {
	const { available, preferences, scheme, showAskerEntry, update } =
		usePersonalDisplayHost(active);
	return (
		<>
			{showAskerEntry && <span>Quick display menu</span>}
			<output>
				{available ? `${scheme} ${preferences.textSize}` : 'pending'}
			</output>
			<button
				onClick={() =>
					update({ ...preferences, scheme: 'dark', textSize: 150 })
				}
			>
				Dark
			</button>
			<button
				onClick={() => update({ ...preferences, scheme: 'system' })}
			>
				System
			</button>
		</>
	);
};

const open = (authority = 'AUTHORIZATION_USER_DEFAULT', active = true) =>
	render(
		<MemoryRouter initialEntries={['/sessions/user/view']}>
			<UserDataContext.Provider
				value={
					{
						userData: {
							grantedAuthorities: [authority]
						}
					} as React.ContextType<typeof UserDataContext>
				}
			>
				<PersonalDisplayProvider>
					<Probe active={active} />
				</PersonalDisplayProvider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);

beforeEach(() => {
	account.identity = 'A';
	query.matches = false;
	vi.stubGlobal('crypto', webcrypto);
	vi.stubGlobal('matchMedia', () => query);
	window.localStorage.clear();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('personal display in the authenticated app', () => {
	it('uses System until overridden and updates when System is selected again', async () => {
		open();
		await screen.findByText('light 100');
		expect(screen.getByText('Quick display menu')).toBeTruthy();
		changeSystemScheme(true);
		await screen.findByText('dark 100');
		fireEvent.click(screen.getByText('Dark'));
		changeSystemScheme(false);
		await screen.findByText('dark 150');
		fireEvent.click(screen.getByText('System'));
		await screen.findByText('light 150');
	});

	it('uses the same preferences for counsellors with no quick menu', async () => {
		const profile = open('AUTHORIZATION_CONSULTANT_DEFAULT');
		await screen.findByText('light 100');
		expect(screen.queryByText('Quick display menu')).toBeNull();
		fireEvent.click(screen.getByText('Dark'));
		await screen.findByText('dark 150');
		changeAccount('B');
		expect(screen.queryByText('dark 150')).toBeNull();
		await screen.findByText('light 100');
		changeAccount('A');
		await screen.findByText('dark 150');
		profile.unmount();

		open('AUTHORIZATION_CONSULTANT_DEFAULT', false);
		expect(screen.getByText('pending')).toBeTruthy();
		expect(screen.queryByText('dark 150')).toBeNull();
	});

	it('does not activate personal settings for an unrelated authority', () => {
		open('AUTHORIZATION_ANONYMOUS_DEFAULT');
		expect(screen.getByText('pending')).toBeTruthy();
		expect(screen.queryByText('Quick display menu')).toBeNull();
	});

	it('keeps an account’s setting across remounts without leaking it across accounts', async () => {
		const first = open();
		await screen.findByText('light 100');
		fireEvent.click(screen.getByText('Dark'));
		await screen.findByText('dark 150');
		// One identity-keyed entry, plus the device's dark-brand choice for the
		// sign-in page (FE#1134), which holds no identity.
		const keys = Object.keys(window.localStorage).filter(
			(name) => name !== 'oriso.dark-brand.v1'
		);
		expect(keys).toHaveLength(1);
		expect(window.localStorage.getItem('oriso.dark-brand.v1')).toBe(
			'counterpart'
		);
		first.unmount();
		open();
		await screen.findByText('dark 150');
		changeAccount('B');
		expect(screen.queryByText('dark 150')).toBeNull();
		await screen.findByText('light 100');
		changeAccount('A');
		await screen.findByText('dark 150');
	});

	it('keeps a running setting when local storage is blocked and drops it on account change', async () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		open();
		await screen.findByText('light 100');
		fireEvent.click(screen.getByText('Dark'));
		await screen.findByText('dark 150');
		changeAccount('B');
		await screen.findByText('light 100');
		changeAccount('A');
		await waitFor(() => expect(screen.queryByText('dark 150')).toBeNull());
		await screen.findByText('light 100');
	});
});
