// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaseHandoverConsentCard } from './CaseHandoverClientCards';

vi.mock('react-i18next', () => {
	const catalogue: Record<string, string> = {
		'caseHandover.consent.sender': 'Carimat',
		'caseHandover.consent.senderRole': 'Quick Guide',
		'caseHandover.consent.title':
			'A counsellor requested access to this conversation',
		'caseHandover.consent.copy':
			'Please approve or decline the request to continue the handover.',
		'caseHandover.consent.approve': 'Approve access',
		'caseHandover.consent.decline': 'Decline access',
		'caseHandover.consent.optOut.title': 'Privacy notice for case handover',
		'caseHandover.consent.optOut.prompt':
			'Please read the information and then make your decision.',
		'caseHandover.consent.optOut.copy':
			'For the case handover, another counsellor from the same counselling centre may temporarily read this conversation. This processes personal data contained in the consultation. Your current counsellor remains responsible for you.',
		'caseHandover.consent.optOut.revocationCopy':
			'By turning on the switch, you consent to the temporary access and the data processing required for it. You may withdraw your consent at any time; active access then ends immediately. Your consultation continues either way.',
		'caseHandover.consent.optOut.switchLabel':
			'I consent to data processing for this case handover',
		'message.menu.open': 'More options',
		'message.deliveryStatus.sent': 'sent'
	};
	const t = (key: string) => catalogue[key] ?? key;
	return {
		useTranslation: () => ({ t })
	};
});

afterEach(cleanup);

describe('CaseHandoverConsentCard', () => {
	it('opens an optional information dialog without deciding the request', () => {
		const approve = vi.fn();
		const decline = vi.fn();
		render(
			<CaseHandoverConsentCard onApprove={approve} onDecline={decline} />
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'caseHandover.consent.info.more'
			})
		);
		expect(screen.getByRole('dialog')).toBeTruthy();
		fireEvent.click(screen.getByTestId('m3-dialog-close'));
		expect(approve).not.toHaveBeenCalled();
		expect(decline).not.toHaveBeenCalled();
	});

	it('keeps the optional overview decision and notification continuation actionable', async () => {
		const approve = vi.fn();
		const setup = vi.fn();
		render(
			<CaseHandoverConsentCard
				onApprove={approve}
				onDecline={vi.fn()}
				onSetupNotifications={setup}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'caseHandover.consent.info.more'
			})
		);
		const dialog = within(screen.getByRole('dialog'));
		expect(
			dialog.getByText('caseHandover.consent.info.description')
		).toBeTruthy();
		fireEvent.click(dialog.getByRole('switch'));
		expect(approve).toHaveBeenCalledOnce();
		fireEvent.click(
			dialog.getByRole('button', {
				name: 'caseHandover.consent.info.notificationsAction'
			})
		);
		expect(setup).toHaveBeenCalledOnce();
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	});

	it('keeps the consent explanation and icon actions inside one Carimat message bubble', () => {
		render(
			<CaseHandoverConsentCard
				onApprove={() => {}}
				onDecline={() => {}}
				timestamp="12:54"
			/>
		);

		expect(screen.getByText('Carimat')).toBeTruthy();
		expect(screen.getByText('Quick Guide')).toBeTruthy();
		const bubble = screen
			.getByText('A counsellor requested access to this conversation')
			.closest('.messageItem__message--systemNotification');
		expect(bubble).toBeTruthy();
		expect(
			bubble?.contains(
				screen.getByText(
					'Please approve or decline the request to continue the handover.'
				)
			)
		).toBe(true);
		expect(
			bubble?.contains(
				screen.getByRole('group', {
					name: 'A counsellor requested access to this conversation'
				})
			)
		).toBe(true);
		expect(bubble?.contains(screen.getByText('12:54'))).toBe(true);
		expect(bubble?.querySelector('.buttonGroup__badge')).toBeNull();
		expect(
			bubble?.querySelectorAll(
				'.buttonGroup > .buttonGroup__track > .buttonGroup__item > .buttonGroup__icon'
			)
		).toHaveLength(2);
	});

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
		const optOutSwitch = screen.getByRole('switch', {
			name: 'I consent to data processing for this case handover'
		}) as HTMLInputElement;
		expect(optOutSwitch.checked).toBe(true);
		expect(
			screen.queryByRole('button', { name: 'Approve access' })
		).toBeNull();

		fireEvent.click(optOutSwitch);
		expect(onDecline).toHaveBeenCalledOnce();
		expect(onApprove).not.toHaveBeenCalled();
	});

	it('keeps informational mode read-only and a controlled decision unchanged on failure', () => {
		const approve = vi.fn();
		const decline = vi.fn();
		const { rerender } = render(
			<CaseHandoverConsentCard
				mode="NONE"
				onApprove={approve}
				onDecline={decline}
			/>
		);
		expect(screen.queryByRole('switch')).toBeNull();
		expect(screen.queryByRole('group')).toBeNull();
		rerender(
			<CaseHandoverConsentCard
				mode="OPT_OUT"
				consentGranted
				onApprove={approve}
				onDecline={decline}
				error="Save failed"
			/>
		);
		fireEvent.click(screen.getByRole('switch'));
		expect(decline).toHaveBeenCalledOnce();
		expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(
			true
		);
		expect(screen.getByRole('alert').textContent).toBe('Save failed');
	});

	it('flips the consent switch to off when the client withdraws consent', () => {
		render(
			<CaseHandoverConsentCard
				mode="OPT_OUT"
				onApprove={() => {}}
				onDecline={() => {}}
			/>
		);

		const optOutSwitch = screen.getByRole('switch', {
			name: 'I consent to data processing for this case handover'
		}) as HTMLInputElement;
		expect(optOutSwitch.checked).toBe(true);

		fireEvent.click(optOutSwitch);
		expect(optOutSwitch.checked).toBe(false);

		fireEvent.click(optOutSwitch);
		expect(optOutSwitch.checked).toBe(true);
	});
});
