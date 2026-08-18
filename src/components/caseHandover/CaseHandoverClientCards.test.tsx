// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaseHandoverConsentCard } from './CaseHandoverClientCards';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key
	})
}));

afterEach(cleanup);

describe('CaseHandoverConsentCard', () => {
	it('renders the active-access decision as a privacy notice with the standard default-on switch', () => {
		const onApprove = vi.fn();
		const onDecline = vi.fn();
		render(
			<CaseHandoverConsentCard
				mode="OPT_OUT"
				onApprove={onApprove}
				onDecline={onDecline}
			/>
		);

		expect(
			screen.getByText('Privacy notice for case handover')
		).toBeTruthy();
		expect(
			screen.getByText(
				'Please read the information and then make your decision.'
			)
		).toBeTruthy();
		expect(
			screen.getByText(
				'For the case handover, another counsellor from the same counselling centre may temporarily read this conversation. This processes personal data contained in the consultation. Your current counsellor remains responsible for you.'
			)
		).toBeTruthy();
		expect(
			screen.getByText(
				'By turning on the switch, you consent to the temporary access and the data processing required for it. You may withdraw your consent at any time; active access then ends immediately. Your consultation continues either way.'
			)
		).toBeTruthy();
		const optOutSwitch = screen.getByRole('switch', {
			name: 'I consent to data processing for this case handover'
		}) as HTMLInputElement;
		expect(optOutSwitch.checked).toBe(true);
		expect(
			screen.queryByRole('button', { name: 'Allow access' })
		).toBeNull();

		fireEvent.click(optOutSwitch);
		expect(onDecline).toHaveBeenCalledOnce();
		expect(onApprove).not.toHaveBeenCalled();
	});
});
