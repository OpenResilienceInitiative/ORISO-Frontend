// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SystemMessage } from './SystemMessage';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../resources/img/icons/call-off.svg', () => ({
	ReactComponent: () => null
}));
vi.mock('../../resources/img/icons/i.svg', () => ({
	ReactComponent: () => null
}));

afterEach(cleanup);

describe('SystemMessage team-access variant', () => {
	it('defaults to allowed and reports an opt-out through the existing variant', async () => {
		const onChange = vi.fn();
		const user = userEvent.setup();
		render(
			<SystemMessage
				variant="team-access"
				teamAccessAllowed
				onTeamAccessChange={onChange}
			/>
		);

		const control = screen.getByRole('switch', {
			name: 'teamAccess.systemMessage.controlLabel'
		});
		expect(control.getAttribute('aria-checked')).toBe('true');
		await user.click(control);
		expect(onChange).toHaveBeenCalledWith(false);
	});

	it('shows the active-consent consequence and save error in the off variant', () => {
		render(
			<SystemMessage
				variant="team-access"
				teamAccessAllowed={false}
				onTeamAccessChange={() => {}}
				error="save failed"
			/>
		);

		expect(
			screen.getByText('teamAccess.systemMessage.consentRequired')
		).toBeTruthy();
		expect(screen.getByRole('alert').textContent).toContain('save failed');
	});

	it('locks the same switch while the request is pending', () => {
		render(
			<SystemMessage
				variant="team-access"
				teamAccessAllowed
				onTeamAccessChange={() => {}}
				pending
			/>
		);
		expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(
			true
		);
	});
});
