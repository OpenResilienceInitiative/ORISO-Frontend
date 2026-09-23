// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmailNotification } from './index';
import { UserDataContext } from '../../../globalState/context/UserDataContext';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../../globalState', async () => ({
	UserDataContext: (
		await import('../../../globalState/context/UserDataContext')
	).UserDataContext,
	hasUserAuthority: () => false,
	AUTHORITIES: { CONSULTANT_DEFAULT: 'consultant' }
}));
vi.mock('./NoEmailSet', () => ({ NoEmailSet: () => null }));
vi.mock('./EmailToggle', () => ({ EmailToggle: () => null }));
vi.mock('./NotificationSwitchRow', () => ({
	NotificationSwitchRow: () => null
}));

const renderAt = (path: string) =>
	render(
		<MemoryRouter initialEntries={[path]}>
			<UserDataContext.Provider
				value={
					{
						userData: { email: null, grantedAuthorities: [] }
					} as never
				}
			>
				<EmailNotification />
			</UserDataContext.Provider>
		</MemoryRouter>
	);

describe('EmailNotification', () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it('scrolls into view when linked with #email-notifications', () => {
		const scroll = vi.fn();
		Element.prototype.scrollIntoView = scroll;
		const { container } = renderAt(
			'/profile/einstellungen/email#email-notifications'
		);
		expect(scroll).toHaveBeenCalledTimes(1);
		expect(scroll.mock.contexts[0]).toBe(
			container.querySelector('#email-notifications')
		);
	});

	it('does not scroll without the anchor', () => {
		const scroll = vi.fn();
		Element.prototype.scrollIntoView = scroll;
		renderAt('/profile/einstellungen/email');
		expect(scroll).not.toHaveBeenCalled();
	});
});
