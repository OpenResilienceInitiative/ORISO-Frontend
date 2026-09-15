// @vitest-environment jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiCreateCaseHandoverOffer,
	apiGetCaseHandoverReasons,
	apiGetCaseHandoverRecipients,
	apiGetCaseHandoverRequestStatus,
	apiGetCaseHandoverStatus
} from '../../api/apiCaseHandover';
import { ActiveSessionContext, UserDataContext } from '../../globalState';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
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
	apiGetCaseHandoverStatus: vi.fn()
}));
vi.mock('../supervisorDialog/SupervisorDialog', () => ({
	SupervisorDialog: (props: any) => (
		<div data-testid="handover-dialog">
			<div data-testid="selected-person">{props.selectedId}</div>
			<div data-testid="selected-reason">{props.reason}</div>
			<button onClick={() => props.onSelect('recipient-1')}>
				person
			</button>
			<button onClick={() => props.onReasonChange('OTHER_EMERGENCY')}>
				reason
			</button>
			<button onClick={props.onConfirm} disabled={props.busy}>
				confirm
			</button>
			<button onClick={props.onClose}>close-dialog</button>
			<div data-testid="dialog-busy">{String(props.busy)}</div>
			<div>
				{props.candidates
					.map((candidate: any) => candidate.name)
					.join(',')}
			</div>
		</div>
	)
}));

const activeSession = {
	isGroup: false,
	consultant: { id: 'owner-1' },
	item: { id: 41, agencyId: 9 }
} as any;

const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

const renderAssign = (
	reloadActiveSession = vi.fn(),
	notificationFeed: any[] = []
) =>
	render(
		<NotificationsContext.Provider
			value={
				{
					notificationFeed,
					refreshNotificationFeed: vi.fn()
				} as any
			}
		>
			<UserDataContext.Provider
				value={
					{
						userData: {
							userId: 'owner-1',
							grantedAuthorities: []
						}
					} as any
				}
			>
				<ActiveSessionContext.Provider
					value={{ activeSession, reloadActiveSession }}
				>
					<AskerInfoAssign
						showLegacyAssignment={false}
						handoverEnabled
					/>
				</ActiveSessionContext.Provider>
			</UserDataContext.Provider>
		</NotificationsContext.Provider>
	);

describe('AskerInfoAssign owner handover', () => {
	afterEach(cleanup);

	beforeEach(() => {
		vi.clearAllMocks();
		resetCaseHandoverOperationStoreForTests();
		vi.mocked(apiGetCaseHandoverStatus).mockResolvedValue({
			sessionId: 41,
			status: 'ACTIVE_OWNER',
			canViewContent: true,
			clientConsentRequired: false,
			ownershipRevision: 7
		});
		vi.mocked(apiGetCaseHandoverReasons).mockResolvedValue([
			{
				code: 'OTHER_EMERGENCY',
				label: 'Emergency',
				clientConsentRequired: false
			}
		]);
		vi.mocked(apiGetCaseHandoverRecipients).mockResolvedValue([
			{ consultantId: 'recipient-1', displayName: 'New Owner' }
		]);
	});

	it('loads authoritative owner data and submits a reason-only PUSH operation', async () => {
		vi.mocked(apiCreateCaseHandoverOffer).mockResolvedValue({
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
		await screen.findByTestId('handover-dialog');
		expect(apiGetCaseHandoverRecipients).toHaveBeenCalledWith(41);
		expect(screen.getByText('New Owner')).toBeTruthy();
		fireEvent.click(screen.getByText('person'));
		fireEvent.click(screen.getByText('reason'));
		fireEvent.click(screen.getByText('confirm'));

		await waitFor(() =>
			expect(apiCreateCaseHandoverOffer).toHaveBeenCalledWith(41, {
				targetConsultantId: 'recipient-1',
				reasonCode: 'OTHER_EMERGENCY',
				expectedOwnershipRevision: 7,
				operationId: expect.any(String)
			})
		);
	});

	it('keeps the request identity and reloads ownership only after authoritative completion', async () => {
		const reload = vi.fn();
		vi.mocked(apiCreateCaseHandoverOffer).mockResolvedValue({
			requestId: 501,
			sessionId: 41,
			status: 'PENDING_RECIPIENT_ACCEPTANCE',
			canViewContent: true,
			clientConsentRequired: false,
			ownershipRevision: 7
		});
		vi.mocked(apiGetCaseHandoverRequestStatus).mockResolvedValue({
			requestId: 501,
			sessionId: 41,
			status: 'GRANTED',
			canViewContent: false,
			clientConsentRequired: false,
			ownershipRevision: 8
		});
		renderAssign(reload);

		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.offer.open' })
		);
		await screen.findByTestId('handover-dialog');
		fireEvent.click(screen.getByText('person'));
		fireEvent.click(screen.getByText('reason'));
		fireEvent.click(screen.getByText('confirm'));
		await waitFor(() =>
			expect(apiCreateCaseHandoverOffer).toHaveBeenCalled()
		);
		await screen.findByRole('status');
		fireEvent(window, new Event('focus'));

		await waitFor(() =>
			expect(apiGetCaseHandoverRequestStatus).toHaveBeenCalledWith(
				41,
				501
			)
		);
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('preserves input and operation identity for an unknown-result retry', async () => {
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
		await screen.findByTestId('handover-dialog');
		fireEvent.click(screen.getByText('person'));
		fireEvent.click(screen.getByText('reason'));
		fireEvent.click(screen.getByText('confirm'));
		await screen.findByRole('alert');

		expect(screen.getByTestId('selected-person').textContent).toBe(
			'recipient-1'
		);
		expect(screen.getByTestId('selected-reason').textContent).toBe(
			'OTHER_EMERGENCY'
		);
		fireEvent.click(screen.getByText('confirm'));
		await waitFor(() =>
			expect(apiCreateCaseHandoverOffer).toHaveBeenCalledTimes(2)
		);
		const calls = vi.mocked(apiCreateCaseHandoverOffer).mock.calls;
		expect(calls[1][1].operationId).toBe(calls[0][1].operationId);
	});

	it('refreshes a 409 and requires a deliberate retry with the new revision and key', async () => {
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
		await screen.findByTestId('handover-dialog');
		fireEvent.click(screen.getByText('person'));
		fireEvent.click(screen.getByText('reason'));
		fireEvent.click(screen.getByText('confirm'));
		await waitFor(() =>
			expect(apiGetCaseHandoverStatus).toHaveBeenCalledTimes(2)
		);
		await screen.findByTestId('handover-dialog');

		fireEvent.click(screen.getByText('confirm'));
		await waitFor(() =>
			expect(apiCreateCaseHandoverOffer).toHaveBeenCalledTimes(2)
		);
		const calls = vi.mocked(apiCreateCaseHandoverOffer).mock.calls;
		expect(calls[0][1].expectedOwnershipRevision).toBe(7);
		expect(calls[1][1].expectedOwnershipRevision).toBe(8);
		expect(calls[1][1].operationId).not.toBe(calls[0][1].operationId);
	});

	it('offers exactly the session-eligible recipients and filters nobody itself', async () => {
		// FE #1262: the wrong-topic colleague must never reach the picker. The
		// server decides that — this asserts the component asks the
		// session-scoped endpoint and then shows its answer unchanged, rather
		// than re-deriving eligibility from the agency-wide consultant list.
		vi.mocked(apiGetCaseHandoverRecipients).mockResolvedValue([
			{ consultantId: 'same-topic', displayName: 'Jonas Lehmann' }
		]);
		renderAssign();

		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.offer.open' })
		);
		await screen.findByTestId('handover-dialog');

		expect(apiGetCaseHandoverRecipients).toHaveBeenCalledWith(41);
		expect(screen.getByText('Jonas Lehmann')).toBeTruthy();
		expect(screen.queryByText(/Ayse Demir/)).toBeNull();
	});

	it('surfaces candidate authorization failure instead of presenting an empty agency', async () => {
		vi.mocked(apiGetCaseHandoverRecipients).mockRejectedValue(
			new Error('FORBIDDEN')
		);
		renderAssign();

		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.offer.open' })
		);

		expect((await screen.findByRole('alert')).textContent).toBe(
			'caseHandover.offer.loadForbidden'
		);
		expect(screen.queryByTestId('handover-dialog')).toBeNull();
	});

	it('reopens during an unresolved submit without staying busy and retries the same intent', async () => {
		const firstResponse = deferred<any>();
		vi.mocked(apiCreateCaseHandoverOffer)
			.mockReturnValueOnce(firstResponse.promise)
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
		await screen.findByTestId('handover-dialog');
		fireEvent.click(screen.getByText('person'));
		fireEvent.click(screen.getByText('reason'));
		fireEvent.click(screen.getByText('confirm'));
		await waitFor(() =>
			expect(apiCreateCaseHandoverOffer).toHaveBeenCalledTimes(1)
		);
		fireEvent.click(screen.getByText('close-dialog'));
		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.offer.open' })
		);
		await screen.findByTestId('handover-dialog');

		expect(screen.getByTestId('dialog-busy').textContent).toBe('false');
		expect(screen.getByTestId('selected-person').textContent).toBe(
			'recipient-1'
		);
		fireEvent.click(screen.getByText('confirm'));
		await waitFor(() =>
			expect(apiCreateCaseHandoverOffer).toHaveBeenCalledTimes(2)
		);
		const calls = vi.mocked(apiCreateCaseHandoverOffer).mock.calls;
		expect(calls[1][1].operationId).toBe(calls[0][1].operationId);
		firstResponse.resolve(calls[1][1] as any);
	});

	it('restores an unresolved sender intent after remount and replays its frozen revision and key', async () => {
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
		const first = renderAssign();
		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.offer.open' })
		);
		await screen.findByTestId('handover-dialog');
		fireEvent.click(screen.getByText('person'));
		fireEvent.click(screen.getByText('reason'));
		fireEvent.click(screen.getByText('confirm'));
		await screen.findByRole('alert');
		const firstCall = vi.mocked(apiCreateCaseHandoverOffer).mock
			.calls[0][1];
		first.unmount();
		vi.mocked(apiGetCaseHandoverStatus).mockResolvedValue({
			sessionId: 41,
			status: 'ACTIVE_OWNER',
			canViewContent: true,
			clientConsentRequired: false,
			ownershipRevision: 8
		});

		renderAssign();
		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.offer.open' })
		);
		await screen.findByTestId('handover-dialog');
		expect(screen.getByTestId('selected-person').textContent).toBe(
			'recipient-1'
		);
		expect(screen.getByTestId('selected-reason').textContent).toBe(
			'OTHER_EMERGENCY'
		);
		fireEvent.click(screen.getByText('confirm'));
		await waitFor(() =>
			expect(apiCreateCaseHandoverOffer).toHaveBeenCalledTimes(2)
		);
		const replay = vi.mocked(apiCreateCaseHandoverOffer).mock.calls[1][1];
		expect(replay.operationId).toBe(firstCall.operationId);
		expect(replay.expectedOwnershipRevision).toBe(7);
	});

	it('ignores a foreign same-session scoped grant without clearing or reloading', async () => {
		const reload = vi.fn();
		vi.mocked(apiCreateCaseHandoverOffer).mockResolvedValue({
			requestId: 501,
			sessionId: 41,
			status: 'PENDING_RECIPIENT_ACCEPTANCE',
			canViewContent: true,
			clientConsentRequired: false,
			ownershipRevision: 7
		});
		vi.mocked(apiGetCaseHandoverRequestStatus).mockResolvedValue({
			requestId: 999,
			sessionId: 41,
			status: 'GRANTED',
			canViewContent: false,
			clientConsentRequired: false,
			ownershipRevision: 8
		});
		renderAssign(reload);
		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.offer.open' })
		);
		await screen.findByTestId('handover-dialog');
		fireEvent.click(screen.getByText('person'));
		fireEvent.click(screen.getByText('reason'));
		fireEvent.click(screen.getByText('confirm'));
		await screen.findByRole('status');
		fireEvent(window, new Event('focus'));
		await waitFor(() =>
			expect(apiGetCaseHandoverRequestStatus).toHaveBeenCalled()
		);

		expect(reload).not.toHaveBeenCalled();
		expect(screen.getByRole('status').textContent).toBe(
			'caseHandover.offer.status.PENDING_RECIPIENT_ACCEPTANCE'
		);
	});

	it('refreshes the exact pending sender request when its resolution event arrives', async () => {
		const reload = vi.fn();
		vi.mocked(apiCreateCaseHandoverOffer).mockResolvedValue({
			requestId: 501,
			sessionId: 41,
			status: 'PENDING_RECIPIENT_ACCEPTANCE',
			canViewContent: true,
			clientConsentRequired: false,
			ownershipRevision: 7
		});
		vi.mocked(apiGetCaseHandoverRequestStatus).mockResolvedValue({
			requestId: 501,
			sessionId: 41,
			status: 'GRANTED',
			canViewContent: false,
			clientConsentRequired: false,
			ownershipRevision: 8
		});
		const view = renderAssign(reload);
		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.offer.open' })
		);
		await screen.findByTestId('handover-dialog');
		fireEvent.click(screen.getByText('person'));
		fireEvent.click(screen.getByText('reason'));
		fireEvent.click(screen.getByText('confirm'));
		await screen.findByRole('status');

		view.rerender(
			<NotificationsContext.Provider
				value={
					{
						notificationFeed: [
							{
								id: 'event-1',
								eventType: 'case.handover.granted',
								sourceSessionId: '41',
								params: { caseHandoverRequestId: 501 }
							}
						],
						refreshNotificationFeed: vi.fn()
					} as any
				}
			>
				<UserDataContext.Provider
					value={
						{
							userData: {
								userId: 'owner-1',
								grantedAuthorities: []
							}
						} as any
					}
				>
					<ActiveSessionContext.Provider
						value={{ activeSession, reloadActiveSession: reload }}
					>
						<AskerInfoAssign
							showLegacyAssignment={false}
							handoverEnabled
						/>
					</ActiveSessionContext.Provider>
				</UserDataContext.Provider>
			</NotificationsContext.Provider>
		);

		await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
	});

	it('uses a backend-shaped null-request grant event only as a scoped refresh hint', async () => {
		const reload = vi.fn();
		vi.mocked(apiCreateCaseHandoverOffer).mockResolvedValue({
			requestId: 501,
			sessionId: 41,
			status: 'PENDING_RECIPIENT_ACCEPTANCE',
			canViewContent: true,
			clientConsentRequired: false,
			ownershipRevision: 7
		});
		vi.mocked(apiGetCaseHandoverRequestStatus).mockResolvedValue({
			requestId: 501,
			sessionId: 41,
			status: 'GRANTED',
			canViewContent: false,
			clientConsentRequired: false,
			ownershipRevision: 8
		});
		const view = renderAssign(reload);
		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.offer.open' })
		);
		await screen.findByTestId('handover-dialog');
		fireEvent.click(screen.getByText('person'));
		fireEvent.click(screen.getByText('reason'));
		fireEvent.click(screen.getByText('confirm'));
		await screen.findByRole('status');

		view.rerender(
			<NotificationsContext.Provider
				value={
					{
						notificationFeed: [
							{
								id: 'actual-grant-event',
								eventType: 'case.handover.granted',
								sourceSessionId: '41',
								params: { caseHandoverRequestId: null }
							}
						],
						refreshNotificationFeed: vi.fn()
					} as any
				}
			>
				<UserDataContext.Provider
					value={
						{
							userData: {
								userId: 'owner-1',
								grantedAuthorities: []
							}
						} as any
					}
				>
					<ActiveSessionContext.Provider
						value={{ activeSession, reloadActiveSession: reload }}
					>
						<AskerInfoAssign
							showLegacyAssignment={false}
							handoverEnabled
						/>
					</ActiveSessionContext.Provider>
				</UserDataContext.Provider>
			</NotificationsContext.Provider>
		);

		await waitFor(() =>
			expect(apiGetCaseHandoverRequestStatus).toHaveBeenCalledWith(
				41,
				501
			)
		);
		await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
	});
});
