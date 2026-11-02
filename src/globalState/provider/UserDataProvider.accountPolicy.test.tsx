// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { UserDataProvider } from './UserDataProvider';
import { UserDataContext } from '../context/UserDataContext';
import { accountPolicyUser } from '../../test/fixtures/askerAccountPolicyFixtures';
import type { UserDataInterface } from '../interfaces/UserDataInterface';
import {
	setValueInCookie,
	deleteCookieByName
} from '../../components/sessionCookie/accessSessionCookie';
import { apiGetUserData } from '../../api';
vi.mock('../../api', () => ({ apiGetUserData: vi.fn() }));
afterEach(() => {
	cleanup();
	deleteCookieByName('keycloak');
	vi.clearAllMocks();
});
const signIn = (sub: string, tenantId = 1) =>
	setValueInCookie(
		'keycloak',
		`header.${btoa(JSON.stringify({ sub, tenantId }))}.sig`
	);
const deferred = () => {
	let resolve: (value: UserDataInterface) => void;
	const promise = new Promise<UserDataInterface>((r) => {
		resolve = r;
	});
	return { promise, resolve: (value: UserDataInterface) => resolve(value) };
};
const Consumer = () => {
	const { userData, reloadUserData } = React.useContext(UserDataContext);
	return (
		<>
			<output>
				{userData?.userId ?? 'pending'}:
				{String(userData?.isAskerEmailCollectionAllowed)}
			</output>
			<button
				onClick={() => void reloadUserData().catch(() => undefined)}
			>
				reload
			</button>
		</>
	);
};
it('ignores A1 after A → B → A and keeps capability unavailable until the current response', async () => {
	const a1 = deferred(),
		b = deferred(),
		a2 = deferred();
	vi.mocked(apiGetUserData)
		.mockReturnValueOnce(a1.promise)
		.mockReturnValueOnce(b.promise)
		.mockReturnValueOnce(a2.promise);
	signIn('A');
	render(
		<UserDataProvider>
			<Consumer />
		</UserDataProvider>
	);
	fireEvent.click(screen.getByRole('button'));
	act(() => signIn('B'));
	fireEvent.click(screen.getByRole('button'));
	await act(async () =>
		b.resolve(
			accountPolicyUser({
				userId: 'B',
				isAskerEmailCollectionAllowed: true
			})
		)
	);
	expect(screen.getByRole('status').textContent).toBe('B:true');
	act(() => signIn('A'));
	fireEvent.click(screen.getByRole('button'));
	expect(screen.getByRole('status').textContent).toBe('pending:undefined');
	await act(async () =>
		a1.resolve(
			accountPolicyUser({
				userId: 'A',
				isAskerEmailCollectionAllowed: true
			})
		)
	);
	expect(screen.getByRole('status').textContent).toBe('pending:undefined');
	await act(async () =>
		a2.resolve(
			accountPolicyUser({
				userId: 'A',
				isAskerEmailCollectionAllowed: false
			})
		)
	);
	expect(screen.getByRole('status').textContent).toBe('A:false');
});
it('treats a tenant change for the same subject as a new request lifetime', async () => {
	const old = deferred();
	vi.mocked(apiGetUserData).mockReturnValueOnce(old.promise);
	signIn('A', 1);
	render(
		<UserDataProvider>
			<Consumer />
		</UserDataProvider>
	);
	fireEvent.click(screen.getByRole('button'));
	act(() => signIn('A', 2));
	await act(async () =>
		old.resolve(
			accountPolicyUser({
				userId: 'A',
				isAskerEmailCollectionAllowed: true
			})
		)
	);
	expect(screen.getByRole('status').textContent).toBe('pending:undefined');
});

it('withdraws capability during reload and ignores an older same-account reply', async () => {
	const initial = deferred(),
		old = deferred(),
		fresh = deferred();
	vi.mocked(apiGetUserData)
		.mockReturnValueOnce(initial.promise)
		.mockReturnValueOnce(old.promise)
		.mockReturnValueOnce(fresh.promise);
	signIn('A');
	render(
		<UserDataProvider>
			<Consumer />
		</UserDataProvider>
	);
	fireEvent.click(screen.getByRole('button'));
	await act(async () =>
		initial.resolve(
			accountPolicyUser({
				userId: 'A',
				isAskerEmailCollectionAllowed: true
			})
		)
	);
	fireEvent.click(screen.getByRole('button'));
	expect(screen.getByRole('status').textContent).toBe('A:undefined');
	fireEvent.click(screen.getByRole('button'));
	await act(async () =>
		fresh.resolve(
			accountPolicyUser({
				userId: 'A',
				isAskerEmailCollectionAllowed: false
			})
		)
	);
	await act(async () =>
		old.resolve(
			accountPolicyUser({
				userId: 'A',
				isAskerEmailCollectionAllowed: true
			})
		)
	);
	expect(screen.getByRole('status').textContent).toBe('A:false');
});

it('withdraws eligibility after a failed reload without discarding existing account data', async () => {
	vi.mocked(apiGetUserData)
		.mockResolvedValueOnce(
			accountPolicyUser({
				userId: 'A',
				isAskerEmailCollectionAllowed: true
			})
		)
		.mockRejectedValueOnce(new Error('unavailable'));
	signIn('A');
	render(
		<UserDataProvider>
			<Consumer />
		</UserDataProvider>
	);
	fireEvent.click(screen.getByRole('button'));
	await screen.findByText('A:true');
	fireEvent.click(screen.getByRole('button'));
	expect(await screen.findByText('A:false')).toBeTruthy();
});
