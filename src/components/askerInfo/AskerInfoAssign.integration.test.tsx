// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	apiCreateCaseHandoverOffer,
	apiGetCaseHandoverReasons,
	apiGetCaseHandoverRecipients,
	apiGetCaseHandoverRequestStatus,
	apiGetCaseHandoverStatus,
	apiWithdrawCaseHandoverOffer
} from '../../api/apiCaseHandover';
import { ActiveSessionContext, UserDataContext } from '../../globalState';
import { resetCaseHandoverOperationStoreForTests } from '../caseHandover/caseHandoverOperationStore';
import { AskerInfoAssign } from './AskerInfoAssign';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../api/apiCaseHandover', () => ({
	apiCreateCaseHandoverOffer: vi.fn(),
	apiGetCaseHandoverReasons: vi.fn(),
	apiGetCaseHandoverRecipients: vi.fn(),
	apiGetCaseHandoverRequestStatus: vi.fn(),
	apiGetCaseHandoverStatus: vi.fn(),
	apiWithdrawCaseHandoverOffer: vi.fn()
}));

const activeSession = {
	isGroup: false,
	consultant: { id: 'owner-1' },
	item: { id: 41, agencyId: 9 }
} as any;

const renderAssign = () =>
	render(
		<UserDataContext.Provider
			value={
				{
					userData: { userId: 'owner-1', grantedAuthorities: [] }
				} as any
			}
		>
			<ActiveSessionContext.Provider
				value={{ activeSession, reloadActiveSession: vi.fn() }}
			>
				<AskerInfoAssign showLegacyAssignment={false} handoverEnabled />
			</ActiveSessionContext.Provider>
		</UserDataContext.Provider>
	);

const fillRealDialog = async () => {
	fireEvent.mouseDown(
		screen.getByRole('combobox', {
			name: 'supervisorDialog.personLabel.handover'
		})
	);
	fireEvent.click(await screen.findByRole('option', { name: 'New Owner' }));
	fireEvent.mouseDown(
		screen.getByRole('combobox', {
			name: 'supervisorDialog.reasonLabel.handover'
		})
	);
	fireEvent.click(
		await screen.findByRole('option', {
			name: 'caseHandover.reason.PLANNED_ABSENCE'
		})
	);
};

describe('AskerInfoAssign with the real SupervisorDialog', () => {
	afterEach(cleanup);

	beforeEach(() => {
		vi.clearAllMocks();
		resetCaseHandoverOperationStoreForTests();
		vi.mocked(apiCreateCaseHandoverOffer).mockReset();
		vi.mocked(apiGetCaseHandoverStatus).mockReset();
		vi.mocked(apiGetCaseHandoverStatus).mockResolvedValue({
			sessionId: 41,
			status: 'ACTIVE_OWNER',
			canViewContent: true,
			clientConsentRequired: false,
			ownershipRevision: 7
		});
		vi.mocked(apiGetCaseHandoverReasons).mockResolvedValue([
			{
				code: 'PLANNED_ABSENCE',
				label: 'Freistellung',
				clientConsentRequired: false
			}
		]);
		vi.mocked(apiGetCaseHandoverRecipients).mockResolvedValue([
			{ consultantId: 'recipient-1', displayName: 'New Owner' }
		]);
	});

	it('preserves the real dialog inputs and operation key after an unknown submit result', async () => {
		vi.mocked(apiCreateCaseHandoverOffer)
			.mockRejectedValueOnce(new Error('NETWORK'))
			.mockResolvedValueOnce({
				requestId: 501,
				sessionId: 41,
				status: 'PENDING_RECIPIENT_ACCEPTANCE',
				canViewContent: true,
				clientConsentRequired: false,
				ownershipRevision: 7
			});
		renderAssign();
		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.offer.open' })
		);
		const dialog = await screen.findByRole('dialog');
		await fillRealDialog();
		fireEvent.click(
			within(dialog).getByTestId('supervisor-dialog-confirm')
		);
		await screen.findByText('caseHandover.offer.submitError');

		expect(within(dialog).getByText('New Owner')).toBeTruthy();
		expect(
			within(dialog).getByText('caseHandover.reason.PLANNED_ABSENCE')
		).toBeTruthy();
		fireEvent.click(
			within(dialog).getByTestId('supervisor-dialog-confirm')
		);
		await waitFor(() =>
			expect(apiCreateCaseHandoverOffer).toHaveBeenCalledTimes(2)
		);
		const calls = vi.mocked(apiCreateCaseHandoverOffer).mock.calls;
		expect(calls[1][1].operationId).toBe(calls[0][1].operationId);
	});

	it('keeps the real selections but refreshes revision and key after a 409', async () => {
		vi.mocked(apiGetCaseHandoverStatus)
			.mockResolvedValueOnce({
				sessionId: 41,
				status: 'ACTIVE_OWNER',
				canViewContent: true,
				clientConsentRequired: false,
				ownershipRevision: 7
			})
			.mockResolvedValueOnce({
				sessionId: 41,
				status: 'ACTIVE_OWNER',
				canViewContent: true,
				clientConsentRequired: false,
				ownershipRevision: 8
			});
		vi.mocked(apiCreateCaseHandoverOffer)
			.mockRejectedValueOnce(new Error('CONFLICT'))
			.mockResolvedValueOnce({
				requestId: 502,
				sessionId: 41,
				status: 'PENDING_RECIPIENT_ACCEPTANCE',
				canViewContent: true,
				clientConsentRequired: false,
				ownershipRevision: 8
			});
		renderAssign();
		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.offer.open' })
		);
		const dialog = await screen.findByRole('dialog');
		await fillRealDialog();
		fireEvent.click(
			within(dialog).getByTestId('supervisor-dialog-confirm')
		);
		await waitFor(() =>
			expect(apiGetCaseHandoverStatus).toHaveBeenCalledTimes(2)
		);

		expect(within(dialog).getByText('New Owner')).toBeTruthy();
		expect(
			within(dialog).getByText('caseHandover.reason.PLANNED_ABSENCE')
		).toBeTruthy();
		fireEvent.click(
			within(dialog).getByTestId('supervisor-dialog-confirm')
		);
		await waitFor(() =>
			expect(apiCreateCaseHandoverOffer).toHaveBeenCalledTimes(2)
		);
		const calls = vi.mocked(apiCreateCaseHandoverOffer).mock.calls;
		expect(calls[0][1].expectedOwnershipRevision).toBe(7);
		expect(calls[1][1].expectedOwnershipRevision).toBe(8);
		expect(calls[1][1].operationId).not.toBe(calls[0][1].operationId);
	});

	describe('withdrawing a pending offer', () => {
		const openOffer = {
			requestId: 501,
			sessionId: 41,
			status: 'PENDING_RECIPIENT_ACCEPTANCE',
			direction: 'PUSH' as const,
			recipientConsultantId: 'recipient-1',
			canViewContent: true,
			clientConsentRequired: false,
			ownershipRevision: 7
		};

		it('finds the open offer again after a reload and shows no second offer form', async () => {
			vi.mocked(apiGetCaseHandoverStatus).mockResolvedValue({
				sessionId: 41,
				status: 'GRANTED',
				canViewContent: true,
				clientConsentRequired: false,
				ownershipRevision: 7,
				openOffer
			});
			renderAssign();
			fireEvent.click(
				screen.getByRole('button', { name: 'caseHandover.offer.open' })
			);

			expect(
				await screen.findByText(
					'caseHandover.offer.status.PENDING_RECIPIENT_ACCEPTANCE'
				)
			).toBeTruthy();
			expect(
				screen.getByRole('button', {
					name: 'caseHandover.offer.withdraw'
				})
			).toBeTruthy();
			expect(screen.queryByRole('dialog')).toBeNull();
		});

		it('withdraws it, says so, and removes the button', async () => {
			vi.mocked(apiGetCaseHandoverStatus).mockResolvedValue({
				sessionId: 41,
				status: 'GRANTED',
				canViewContent: true,
				clientConsentRequired: false,
				ownershipRevision: 7,
				openOffer
			});
			vi.mocked(apiWithdrawCaseHandoverOffer).mockResolvedValue({
				...openOffer,
				status: 'WITHDRAWN'
			});
			renderAssign();
			fireEvent.click(
				screen.getByRole('button', { name: 'caseHandover.offer.open' })
			);
			fireEvent.click(
				await screen.findByRole('button', {
					name: 'caseHandover.offer.withdraw'
				})
			);

			expect(
				await screen.findByText('caseHandover.offer.status.WITHDRAWN')
			).toBeTruthy();
			expect(apiWithdrawCaseHandoverOffer).toHaveBeenCalledWith(41, 501);
			expect(
				screen.queryByRole('button', {
					name: 'caseHandover.offer.withdraw'
				})
			).toBeNull();
		});

		it('offers the withdrawal right after the offer was sent', async () => {
			vi.mocked(apiCreateCaseHandoverOffer).mockResolvedValue(openOffer);
			renderAssign();
			fireEvent.click(
				screen.getByRole('button', { name: 'caseHandover.offer.open' })
			);
			const dialog = await screen.findByRole('dialog');
			await fillRealDialog();
			fireEvent.click(
				within(dialog).getByTestId('supervisor-dialog-confirm')
			);

			expect(
				await screen.findByRole('button', {
					name: 'caseHandover.offer.withdraw'
				})
			).toBeTruthy();
		});

		it('tells the counsellor when the colleague answered first instead of pretending it worked', async () => {
			vi.mocked(apiGetCaseHandoverStatus).mockResolvedValue({
				sessionId: 41,
				status: 'GRANTED',
				canViewContent: true,
				clientConsentRequired: false,
				ownershipRevision: 7,
				openOffer
			});
			vi.mocked(apiWithdrawCaseHandoverOffer).mockRejectedValue(
				new Error('CONFLICT')
			);
			vi.mocked(apiGetCaseHandoverRequestStatus).mockResolvedValue({
				...openOffer,
				status: 'RECIPIENT_DECLINED'
			});
			renderAssign();
			fireEvent.click(
				screen.getByRole('button', { name: 'caseHandover.offer.open' })
			);
			fireEvent.click(
				await screen.findByRole('button', {
					name: 'caseHandover.offer.withdraw'
				})
			);

			expect(
				await screen.findByText('caseHandover.offer.withdrawConflict')
			).toBeTruthy();
			expect(
				await screen.findByText(
					'caseHandover.offer.status.RECIPIENT_DECLINED'
				)
			).toBeTruthy();
		});

		it('keeps the offer pending and says so when the withdrawal fails', async () => {
			vi.mocked(apiGetCaseHandoverStatus).mockResolvedValue({
				sessionId: 41,
				status: 'GRANTED',
				canViewContent: true,
				clientConsentRequired: false,
				ownershipRevision: 7,
				openOffer
			});
			vi.mocked(apiWithdrawCaseHandoverOffer).mockRejectedValue(
				new Error('NETWORK')
			);
			renderAssign();
			fireEvent.click(
				screen.getByRole('button', { name: 'caseHandover.offer.open' })
			);
			fireEvent.click(
				await screen.findByRole('button', {
					name: 'caseHandover.offer.withdraw'
				})
			);

			expect(
				await screen.findByText('caseHandover.offer.withdrawError')
			).toBeTruthy();
			expect(
				screen.getByRole('button', {
					name: 'caseHandover.offer.withdraw'
				})
			).toBeTruthy();
		});
	});
});
