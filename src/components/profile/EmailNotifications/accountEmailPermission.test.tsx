// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { MemoryRouter } from 'react-router-dom';
import { EmailNotification } from './index';
import { SetEmailModal } from './SetEmailModal';
import { UserDataContext } from '../../../globalState/context/UserDataContext';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import {
	accountPolicyTenant,
	accountPolicyUser
} from '../../../test/fixtures/askerAccountPolicyFixtures';
import { apiPutEmail } from '../../../api';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../../api', () => ({
	apiPutEmail: vi.fn().mockResolvedValue(undefined),
	FETCH_ERRORS: { X_REASON: 'x-reason' },
	X_REASON: { EMAIL_NOT_AVAILABLE: 'email-not-available' }
}));
vi.mock('../../../globalState', async () => {
	const ReactModule = await import('react');
	const helpers = await import('../../../globalState/helpers/stateHelpers');
	return {
		...helpers,
		UserDataContext: (
			await import('../../../globalState/context/UserDataContext')
		).UserDataContext,
		NotificationsContext: ReactModule.createContext({
			addNotification: vi.fn()
		})
	};
});
// Keep the real input, validation and mutation hook. Only the modal's portal and
// focus stack are unrelated to permission propagation.
vi.mock('../../overlay/Overlay', () => ({
	OVERLAY_FUNCTIONS: { CLOSE: 'CLOSE' },
	Overlay: ({
		item,
		handleOverlay
	}: React.ComponentProps<
		typeof import('../../overlay/Overlay').Overlay
	>) => (
		<div>
			{item.nestedComponent}
			{item.buttonSet.map((button) => (
				<button
					key={button.label}
					type="button"
					disabled={button.disabled}
					onClick={() => handleOverlay(button.function)}
				>
					{button.label}
				</button>
			))}
		</div>
	)
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const tree = (
	allowed: boolean | undefined,
	consultant = false,
	child: React.ReactNode = <EmailNotification />
) => {
	const user = accountPolicyUser({
		grantedAuthorities: [
			consultant
				? 'AUTHORIZATION_CONSULTANT_DEFAULT'
				: 'AUTHORIZATION_USER_DEFAULT'
		]
	});
	return (
		<MemoryRouter>
			<UserDataContext.Provider
				value={{
					userData: user,
					setUserData: vi.fn(),
					reloadUserData: vi.fn().mockResolvedValue(user)
				}}
			>
				<TenantContext.Provider
					value={{
						tenant: accountPolicyTenant({
							featureAskerEmailEnabled: allowed
						}),
						setTenant: vi.fn(),
						updateTenantSettings: vi.fn()
					}}
				>
					{child}
				</TenantContext.Provider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);
};

describe('account email collection entry points', () => {
	it('does not solicit email or leave an empty panel when an asker is forbidden', () => {
		const { container } = render(tree(false));
		expect(
			screen.queryByRole('button', {
				name: 'profile.notifications.noEmail.button'
			})
		).toBeNull();
		expect(
			screen.queryByText('profile.notifications.noEmail.info')
		).toBeNull();
		expect(container.querySelector('.notifications__panel')).toBeNull();
	});
	it.each([true, undefined])(
		'retains the existing invitation when permission is %s',
		(allowed) => {
			render(tree(allowed));
			expect(
				screen.getByRole('button', {
					name: 'profile.notifications.noEmail.button'
				})
			).toBeTruthy();
		}
	);
	it('does not apply asker restrictions to a consultant saving their email', async () => {
		render(tree(false, true));
		fireEvent.click(
			screen.getByRole('button', {
				name: 'profile.notifications.noEmail.button'
			})
		);
		fireEvent.change(
			screen.getByLabelText(
				'profile.notifications.noEmail.modal.emailInput.label'
			),
			{
				target: { value: 'consultant@example.test' }
			}
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'profile.notifications.noEmail.modal.confirm'
			})
		);
		await waitFor(() =>
			expect(apiPutEmail).toHaveBeenCalledWith('consultant@example.test')
		);
	});
	it('withdraws an already-open email dialog when permission changes', () => {
		const child = <SetEmailModal onClose={vi.fn()} />;
		const view = render(tree(true, false, child));
		fireEvent.change(
			screen.getByLabelText(
				'profile.notifications.noEmail.modal.emailInput.label'
			),
			{
				target: { value: 'asker@example.test' }
			}
		);
		view.rerender(tree(false, false, child));
		expect(
			screen.queryByRole('button', {
				name: 'profile.notifications.noEmail.modal.confirm'
			})
		).toBeNull();
		expect(apiPutEmail).not.toHaveBeenCalled();
	});
});
