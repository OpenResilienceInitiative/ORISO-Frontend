// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState';
import { MandatorySecondFactorGate } from './MandatorySecondFactorGate';

const dialogProps = vi.hoisted(() => ({ current: null as any }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

// jsdom has no canvas; the real module is only reachable transitively here.
vi.mock('../animatedIllustration/AnimatedIllustration', () => ({
	CheckAnimation: () => null
}));

vi.mock('./TwoFactorSetupDialog', () => ({
	TwoFactorSetupDialog: (props: any) => {
		dialogProps.current = props;
		return <div data-testid="setup-dialog" />;
	}
}));

const renderGate = (onLogout = vi.fn()) => {
	const userData: any = {
		email: 'counsellor@example.com',
		twoFactorAuth: {
			isEnabled: true,
			isRequired: true,
			isActive: false,
			qrCode: 'qr',
			secret: 'secret'
		}
	};
	const reloadUserData = vi.fn().mockResolvedValue(undefined);

	render(
		<UserDataContext.Provider value={{ userData, reloadUserData } as any}>
			<MandatorySecondFactorGate onLogout={onLogout} />
		</UserDataContext.Provider>
	);

	return { onLogout, reloadUserData };
};

afterEach(cleanup);

describe('MandatorySecondFactorGate', () => {
	it('opens the setup dialog with no way to close or disable it', () => {
		renderGate();

		expect(screen.getByTestId('setup-dialog')).not.toBeNull();
		expect(dialogProps.current.open).toBe(true);
		expect(dialogProps.current.canClose).toBe(false);
		expect(dialogProps.current.canDisable).toBe(false);
	});

	it('offers logging out as the only other way on', async () => {
		const { onLogout } = renderGate();

		await userEvent.click(
			screen.getByRole('button', {
				name: 'twoFactorAuth.required.logout'
			})
		);

		expect(onLogout).toHaveBeenCalled();
	});

	it('re-reads the profile after setup so the server decides the factor counts', async () => {
		const { reloadUserData } = renderGate();

		await dialogProps.current.onSetupComplete();

		expect(reloadUserData).toHaveBeenCalled();
	});

	it('passes the enrolment material through to the dialog', () => {
		renderGate();

		expect(dialogProps.current.qrCode).toBe('qr');
		expect(dialogProps.current.secret).toBe('secret');
		expect(dialogProps.current.email).toBe('counsellor@example.com');
	});
});
