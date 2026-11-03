// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { TwoFactorSetupDialog } from './TwoFactorSetupDialog';
import { UserDataProvider } from '../../globalState/provider/UserDataProvider';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import {
	accountPolicyTenant,
	accountPolicyUser
} from '../../test/fixtures/askerAccountPolicyFixtures';
import {
	setValueInCookie,
	deleteCookieByName
} from '../sessionCookie/accessSessionCookie';
import {
	apiGetUserData,
	apiPutTwoFactorAuthEmail,
	apiPostTwoFactorAuthEmailWithCode
} from '../../api';
import type { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../api', () => ({
	apiGetUserData: vi.fn(),
	apiPutTwoFactorAuthEmail: vi.fn().mockResolvedValue(undefined),
	apiPostTwoFactorAuthEmailWithCode: vi.fn().mockResolvedValue(undefined),
	apiPatchTwoFactorAuthEncourage: vi.fn().mockResolvedValue(undefined),
	FETCH_ERRORS: {
		BAD_REQUEST: 'BAD_REQUEST',
		CONFLICT: 'CONFLICT',
		PRECONDITION_FAILED: 'PRECONDITION_FAILED',
		TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS'
	}
}));
afterEach(() => {
	cleanup();
	deleteCookieByName('keycloak');
	vi.clearAllMocks();
});
const reload = () => {
	let resolve: (user: UserDataInterface) => void;
	const promise = new Promise<UserDataInterface>((yes) => {
		resolve = yes;
	});
	return { promise, resolve: (user: UserDataInterface) => resolve(user) };
};
const Dialog = () => {
	const { userData, reloadUserData } = React.useContext(UserDataContext);
	React.useEffect(() => {
		void reloadUserData();
	}, [reloadUserData]);
	if (!userData) return null;
	return (
		<TwoFactorSetupDialog
			open
			canClose
			canDisable={false}
			email={userData.email ?? ''}
			onClose={() => undefined}
			onDisable={() => undefined}
			onSetupComplete={async () => {
				await reloadUserData();
			}}
		/>
	);
};
it('keeps committed email-factor success through its own real provider capability reload', async () => {
	const pending = reload();
	vi.mocked(apiGetUserData)
		.mockResolvedValueOnce(
			accountPolicyUser({
				email: undefined,
				isAskerEmailCollectionAllowed: true
			})
		)
		.mockReturnValueOnce(pending.promise);
	setValueInCookie(
		'keycloak',
		`header.${btoa(JSON.stringify({ sub: 'policy-asker', tenantId: 1 }))}.sig`
	);
	render(
		<TenantContext.Provider
			value={{
				tenant: accountPolicyTenant({
					featureAskerEmailCollectionSelfHelpEnabled: false
				}),
				setTenant: vi.fn(),
				updateTenantSettings: vi.fn()
			}}
		>
			<UserDataProvider>
				<ModalProvider>
					<div className="app" />
					<Dialog />
				</ModalProvider>
			</UserDataProvider>
		</TenantContext.Provider>
	);
	fireEvent.click(
		await screen.findByRole('button', {
			name: 'twoFactorAuth.setupDialog.decision.email'
		})
	);
	fireEvent.change(
		await screen.findByLabelText(
			'twoFactorAuth.setupDialog.email.select.input'
		),
		{ target: { value: 'new@example.test' } }
	);
	fireEvent.click(
		screen.getByRole('button', {
			name: 'twoFactorAuth.setupDialog.action.next'
		})
	);
	await waitFor(() =>
		expect(apiPutTwoFactorAuthEmail).toHaveBeenCalledWith(
			'new@example.test'
		)
	);
	fireEvent.change(
		await screen.findByLabelText(
			'twoFactorAuth.setupDialog.email.connect.input'
		),
		{ target: { value: '123456' } }
	);
	fireEvent.click(
		screen.getByRole('button', {
			name: 'twoFactorAuth.setupDialog.action.confirm'
		})
	);
	await waitFor(() =>
		expect(apiPostTwoFactorAuthEmailWithCode).toHaveBeenCalledWith('123456')
	);
	await waitFor(() => expect(apiGetUserData).toHaveBeenCalledTimes(2));
	await act(async () =>
		pending.resolve(
			accountPolicyUser({
				email: 'new@example.test',
				isAskerEmailCollectionAllowed: true
			})
		)
	);
	expect(
		await screen.findByText('twoFactorAuth.setupDialog.email.success.title')
	).toBeTruthy();
	expect(apiPutTwoFactorAuthEmail).toHaveBeenCalledTimes(1);
	expect(apiPostTwoFactorAuthEmailWithCode).toHaveBeenCalledTimes(1);
});
