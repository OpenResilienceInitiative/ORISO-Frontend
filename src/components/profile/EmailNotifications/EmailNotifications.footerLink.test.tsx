// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsContext, UserDataContext } from '../../../globalState';
import { EmailNotification } from './index';

vi.mock('../../../api/apiPatchUserData', () => ({ apiPatchUserData: vi.fn() }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const scrollIntoView = vi.fn();

const renderFromFooterLink = (
	mail: string,
	role: 'consultant' | 'asker' = 'consultant'
) =>
	render(
		<MemoryRouter
			initialEntries={[`/profile/einstellungen/email?mail=${mail}`]}
		>
			<NotificationsContext.Provider
				value={{ addNotification: vi.fn() } as never}
			>
				<UserDataContext.Provider
					value={
						{
							userData: {
								email: 'footer-link@example.test',
								grantedAuthorities: [
									role === 'consultant'
										? 'AUTHORIZATION_CONSULTANT_DEFAULT'
										: 'AUTHORIZATION_USER_DEFAULT'
								],
								emailNotifications: {
									emailNotificationsEnabled: true,
									settings: {}
								},
								emailToggles: []
							},
							reloadUserData: vi.fn()
						} as never
					}
				>
					<EmailNotification />
				</UserDataContext.Provider>
			</NotificationsContext.Provider>
		</MemoryRouter>
	);

beforeEach(() => {
	scrollIntoView.mockReset();
	Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
		configurable: true,
		value: scrollIntoView
	});
});

afterEach(() => {
	cleanup();
});

describe('arriving from an email footer link (#872)', () => {
	it('moves keyboard focus to the switch of the mail the link came from', () => {
		renderFromFooterLink('uebergabe-bestaetigt');
		const reassignment = screen.getByRole('switch', {
			name: 'profile.notifications.matrix.consultant.reassignment.title'
		});
		expect(document.activeElement).toBe(reassignment);
		expect(scrollIntoView).toHaveBeenCalled();
	});

	it('focuses the advice-seeker switch for an advice-seeker mail', () => {
		renderFromFooterLink('termin', 'asker');
		expect(document.activeElement).toBe(
			screen.getByRole('switch', {
				name: 'profile.notifications.matrix.asker.appointment.title'
			})
		);
	});

	it.each([
		['an unknown value', 'not-a-mail'],
		['a mail without a switch', 'einmalcode'],
		['an empty value', '']
	])('falls back to the plain panel for %s', (_label, mail) => {
		renderFromFooterLink(mail);
		expect(screen.getAllByRole('switch').length).toBeGreaterThan(1);
		expect(document.activeElement).toBe(document.body);
		expect(scrollIntoView).not.toHaveBeenCalled();
	});

	it('does not focus anything when the occasion belongs to the other role', () => {
		renderFromFooterLink('neue-anfrage', 'asker');
		expect(document.activeElement).toBe(document.body);
	});
});
