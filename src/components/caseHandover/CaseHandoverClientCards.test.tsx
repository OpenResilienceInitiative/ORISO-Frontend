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
	it('reuses the consent card as a default-on opt-out switch after access started', () => {
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
			screen.getByText('A counsellor has access to this conversation')
		).toBeTruthy();
		const optOutSwitch = screen.getByRole('switch', {
			name: 'Allow access for this case handover'
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
