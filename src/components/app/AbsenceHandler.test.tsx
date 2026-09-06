// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AbsenceHandler } from './AbsenceHandler';
import { UserDataContext } from '../../globalState';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../api', () => ({ apiSetAbsence: vi.fn(() => Promise.resolve()) }));
vi.mock('../animatedIllustration/AnimatedIllustration', () => ({
	CheckAnimation: () => null
}));
// The real Overlay portals into document.body with a focus trap; the gate
// under test is whether the handler renders it at all.
vi.mock('../overlay/Overlay', () => ({
	OVERLAY_FUNCTIONS: {
		CLOSE: 'CLOSE',
		DEACTIVATE_ABSENCE: 'DEACTIVATE_ABSENCE'
	},
	Overlay: ({ item }: any) => (
		<div role="dialog" data-testid="absence-overlay">
			{item.headline}
		</div>
	)
}));

const consultant = (overrides: Record<string, unknown> = {}) => ({
	userId: 'consultant-1',
	userName: 'lisa',
	grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
	absent: true,
	absenceMessage: 'Im Urlaub',
	...overrides
});
const asker = (overrides: Record<string, unknown> = {}) => ({
	userId: 'asker-1',
	userName: 'ratsuchender',
	grantedAuthorities: ['AUTHORIZATION_ASKER_DEFAULT'],
	absent: true, // stale / mixed data: an absence flag on a non-consultant
	absenceMessage: 'Im Urlaub',
	...overrides
});

const renderWith = (userData: any) => {
	const reloadUserData = vi.fn(() => Promise.resolve(userData));
	const utils = render(
		<UserDataContext.Provider
			value={{ userData, setUserData: vi.fn(), reloadUserData } as any}
		>
			<AbsenceHandler />
		</UserDataContext.Provider>
	);
	const rerenderWith = (next: any) =>
		utils.rerender(
			<UserDataContext.Provider
				value={
					{
						userData: next,
						setUserData: vi.fn(),
						reloadUserData
					} as any
				}
			>
				<AbsenceHandler />
			</UserDataContext.Provider>
		);
	return { ...utils, rerenderWith };
};

describe('AbsenceHandler (#1210 job 2: the reminder only in the counsellor context)', () => {
	beforeEach(() => {
		document.cookie = 'keycloak=token; path=/';
	});
	afterEach(() => {
		cleanup();
		document.cookie =
			'keycloak=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
	});

	it('shows the reminder once for an absent counsellor', () => {
		renderWith(consultant());
		expect(screen.getByTestId('absence-overlay').textContent).toContain(
			'absence.overlay.headline'
		);
	});

	it('shows nothing for a counsellor who is not absent', () => {
		renderWith(consultant({ absent: false }));
		expect(screen.queryByTestId('absence-overlay')).toBeNull();
	});

	it('shows nothing when the context holds non-consultant data, even with an absence flag', () => {
		renderWith(asker());
		expect(screen.queryByTestId('absence-overlay')).toBeNull();
	});

	it('shows nothing before user data is loaded', () => {
		renderWith(null);
		expect(screen.queryByTestId('absence-overlay')).toBeNull();
	});

	it('shows nothing while the auth session is gone (sign-out in flight)', () => {
		document.cookie =
			'keycloak=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
		renderWith(consultant());
		expect(screen.queryByTestId('absence-overlay')).toBeNull();
	});

	it('re-evaluates when a different counsellor signs in without a remount', () => {
		const { rerenderWith } = renderWith(consultant({ absent: false }));
		expect(screen.queryByTestId('absence-overlay')).toBeNull();
		rerenderWith(consultant({ userId: 'consultant-2', absent: true }));
		expect(screen.getByTestId('absence-overlay')).toBeTruthy();
	});

	it('does not re-open for the same counsellor when user data merely refreshes', () => {
		const { rerenderWith } = renderWith(consultant());
		expect(screen.getByTestId('absence-overlay')).toBeTruthy();
		// user dismissed via CLOSE is exercised by the Overlay; simulate the
		// handler's own state by re-rendering with the same user again
		rerenderWith(consultant({ absenceMessage: 'Noch im Urlaub' }));
		expect(screen.getAllByTestId('absence-overlay')).toHaveLength(1);
	});
});
