// @vitest-environment jsdom

import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiDecideCaseHandoverRecipient,
	apiGetCaseHandoverRequestStatus,
	CaseHandoverStatus
} from '../../api/apiCaseHandover';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { CaseHandoverOfferGate } from './CaseHandoverOfferGate';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../api/apiCaseHandover', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../api/apiCaseHandover')>();
	return {
		...actual,
		apiDecideCaseHandoverRecipient: vi.fn(),
		apiGetCaseHandoverRequestStatus: vi.fn()
	};
});

const status = (
	overrides: Partial<CaseHandoverStatus> = {}
): CaseHandoverStatus => ({
	requestId: 501,
	sessionId: 41,
	status: 'PENDING_RECIPIENT_ACCEPTANCE',
	canViewContent: false,
	ownershipRevision: 7,
	clientConsentRequired: false,
	...overrides
});

const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
};

describe('CaseHandoverOfferGate', () => {
	afterEach(cleanup);

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiGetCaseHandoverRequestStatus).mockReset();
		vi.mocked(apiDecideCaseHandoverRecipient).mockReset();
	});

	it('keeps the real session subtree unmounted until the exact scoped request grants content', async () => {
		vi.mocked(apiGetCaseHandoverRequestStatus).mockResolvedValue(status());
		vi.mocked(apiDecideCaseHandoverRecipient).mockResolvedValue(
			status({ status: 'PENDING_CLIENT_CONSENT' })
		);

		render(
			<CaseHandoverOfferGate
				actorId="recipient-a"
				sessionId={41}
				requestId={501}
				onClose={vi.fn()}
			>
				<div data-testid="normal-session">history and metadata</div>
			</CaseHandoverOfferGate>
		);

		expect(screen.queryByTestId('normal-session')).toBeNull();
		await screen.findByText('caseHandover.offer.title');
		expect(apiGetCaseHandoverRequestStatus).toHaveBeenCalledWith(41, 501);

		fireEvent.click(screen.getByTestId('case-handover-offer-accept'));
		await waitFor(() =>
			expect(apiDecideCaseHandoverRecipient).toHaveBeenCalledWith(
				41,
				501,
				true
			)
		);
		expect(screen.queryByTestId('normal-session')).toBeNull();

		vi.mocked(apiGetCaseHandoverRequestStatus).mockResolvedValue(
			status({ status: 'GRANTED', canViewContent: true })
		);
		fireEvent(window, new Event('focus'));

		expect(await screen.findByTestId('normal-session')).toBeTruthy();
	});

	it('declines explicitly while close only navigates away', async () => {
		const onClose = vi.fn();
		vi.mocked(apiGetCaseHandoverRequestStatus).mockResolvedValue(status());
		vi.mocked(apiDecideCaseHandoverRecipient).mockResolvedValue(
			status({ status: 'RECIPIENT_DECLINED' })
		);
		const { rerender } = render(
			<CaseHandoverOfferGate
				actorId="recipient-a"
				sessionId={41}
				requestId={501}
				onClose={onClose}
			>
				<div>private</div>
			</CaseHandoverOfferGate>
		);
		await screen.findByText('caseHandover.offer.title');

		fireEvent.click(screen.getByTestId('m3-dialog-close'));
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(apiDecideCaseHandoverRecipient).not.toHaveBeenCalled();

		rerender(
			<CaseHandoverOfferGate
				actorId="recipient-a"
				sessionId={41}
				requestId={501}
				onClose={onClose}
			>
				<div>private</div>
			</CaseHandoverOfferGate>
		);
		fireEvent.click(screen.getByTestId('case-handover-offer-decline'));
		await waitFor(() =>
			expect(apiDecideCaseHandoverRecipient).toHaveBeenCalledWith(
				41,
				501,
				false
			)
		);
		expect(screen.getByText('caseHandover.offer.declined')).toBeTruthy();
	});

	it('isolates A to B request churn and ignores reverse-order stale responses', async () => {
		const requestA = deferred<CaseHandoverStatus>();
		const requestB = deferred<CaseHandoverStatus>();
		vi.mocked(apiGetCaseHandoverRequestStatus)
			.mockReturnValueOnce(requestA.promise)
			.mockReturnValueOnce(requestB.promise);

		const { rerender } = render(
			<CaseHandoverOfferGate
				actorId="recipient-a"
				sessionId={41}
				requestId={501}
				onClose={vi.fn()}
			>
				<div data-testid="normal-session">private</div>
			</CaseHandoverOfferGate>
		);
		rerender(
			<CaseHandoverOfferGate
				actorId="recipient-a"
				sessionId={41}
				requestId={502}
				onClose={vi.fn()}
			>
				<div data-testid="normal-session">private</div>
			</CaseHandoverOfferGate>
		);

		await act(async () => {
			requestB.resolve(
				status({
					requestId: 502,
					status: 'PENDING_RECIPIENT_ACCEPTANCE'
				})
			);
		});
		await screen.findByText('caseHandover.offer.title');
		await act(async () => {
			requestA.resolve(
				status({ status: 'GRANTED', canViewContent: true })
			);
		});

		expect(screen.queryByTestId('normal-session')).toBeNull();
		expect(apiGetCaseHandoverRequestStatus).toHaveBeenNthCalledWith(
			1,
			41,
			501
		);
		expect(apiGetCaseHandoverRequestStatus).toHaveBeenNthCalledWith(
			2,
			41,
			502
		);
	});

	it('seals a previously granted subtree synchronously when request or actor identity changes', async () => {
		const nextRequest = deferred<CaseHandoverStatus>();
		const renderPrivate = vi.fn();
		const PrivateSession = () => {
			renderPrivate();
			return <div data-testid="normal-session">private</div>;
		};
		vi.mocked(apiGetCaseHandoverRequestStatus)
			.mockResolvedValueOnce(
				status({ status: 'GRANTED', canViewContent: true })
			)
			.mockReturnValue(nextRequest.promise);

		const { rerender } = render(
			<CaseHandoverOfferGate
				actorId="recipient-a"
				sessionId={41}
				requestId={501}
				onClose={vi.fn()}
			>
				<PrivateSession />
			</CaseHandoverOfferGate>
		);
		expect(await screen.findByTestId('normal-session')).toBeTruthy();
		expect(renderPrivate).toHaveBeenCalledTimes(1);

		rerender(
			<CaseHandoverOfferGate
				actorId="recipient-a"
				sessionId={41}
				requestId={502}
				onClose={vi.fn()}
			>
				<PrivateSession />
			</CaseHandoverOfferGate>
		);
		expect(screen.queryByTestId('normal-session')).toBeNull();
		expect(renderPrivate).toHaveBeenCalledTimes(1);

		rerender(
			<CaseHandoverOfferGate
				actorId="recipient-b"
				sessionId={41}
				requestId={502}
				onClose={vi.fn()}
			>
				<PrivateSession />
			</CaseHandoverOfferGate>
		);
		expect(screen.queryByTestId('normal-session')).toBeNull();
		expect(renderPrivate).toHaveBeenCalledTimes(1);
	});

	it('does not let a focus refresh supersede an in-flight recipient decision', async () => {
		const decision = deferred<CaseHandoverStatus>();
		vi.mocked(apiGetCaseHandoverRequestStatus).mockResolvedValue(status());
		vi.mocked(apiDecideCaseHandoverRecipient).mockReturnValue(
			decision.promise
		);
		render(
			<CaseHandoverOfferGate
				actorId="recipient-a"
				sessionId={41}
				requestId={501}
				onClose={vi.fn()}
			>
				<div data-testid="normal-session">private</div>
			</CaseHandoverOfferGate>
		);
		await screen.findByTestId('case-handover-offer-accept');

		fireEvent.click(screen.getByTestId('case-handover-offer-accept'));
		fireEvent(window, new Event('focus'));
		expect(apiGetCaseHandoverRequestStatus).toHaveBeenCalledTimes(1);
		await act(async () => {
			decision.resolve(
				status({ status: 'GRANTED', canViewContent: true })
			);
		});

		expect(await screen.findByTestId('normal-session')).toBeTruthy();
	});

	it('keeps forbidden, missing and granted-without-permission responses request-only', async () => {
		vi.mocked(apiGetCaseHandoverRequestStatus)
			.mockRejectedValueOnce(new Error('FORBIDDEN'))
			.mockRejectedValueOnce(new Error('NO_MATCH'))
			.mockResolvedValueOnce(
				status({
					requestId: 503,
					status: 'GRANTED',
					canViewContent: false
				})
			);

		const { rerender } = render(
			<CaseHandoverOfferGate
				actorId="recipient-a"
				sessionId={41}
				requestId={501}
				onClose={vi.fn()}
			>
				<div data-testid="normal-session">private</div>
			</CaseHandoverOfferGate>
		);
		expect(
			await screen.findByText('caseHandover.offer.forbidden')
		).toBeTruthy();

		rerender(
			<CaseHandoverOfferGate
				actorId="recipient-a"
				sessionId={41}
				requestId={502}
				onClose={vi.fn()}
			>
				<div data-testid="normal-session">private</div>
			</CaseHandoverOfferGate>
		);
		expect(
			await screen.findByText('caseHandover.offer.notFound')
		).toBeTruthy();

		rerender(
			<CaseHandoverOfferGate
				actorId="recipient-a"
				sessionId={41}
				requestId={503}
				onClose={vi.fn()}
			>
				<div data-testid="normal-session">private</div>
			</CaseHandoverOfferGate>
		);
		await waitFor(() =>
			expect(apiGetCaseHandoverRequestStatus).toHaveBeenCalledWith(
				41,
				503
			)
		);
		expect(screen.queryByTestId('normal-session')).toBeNull();
		expect(
			await screen.findByText('caseHandover.offer.noContent')
		).toBeTruthy();
	});

	it('never releases content for a scoped response with another request identity', async () => {
		vi.mocked(apiGetCaseHandoverRequestStatus).mockResolvedValue(
			status({ requestId: 999, status: 'GRANTED', canViewContent: true })
		);
		render(
			<CaseHandoverOfferGate
				actorId="recipient-a"
				sessionId={41}
				requestId={501}
				onClose={vi.fn()}
			>
				<div data-testid="normal-session">private</div>
			</CaseHandoverOfferGate>
		);

		expect(
			await screen.findByText('caseHandover.offer.notFound')
		).toBeTruthy();
		expect(screen.queryByTestId('normal-session')).toBeNull();
	});

	it('renders distinct terminal denial copy while keeping content sealed', async () => {
		vi.mocked(apiGetCaseHandoverRequestStatus)
			.mockResolvedValueOnce(status({ status: 'DENIED' }))
			.mockResolvedValueOnce(
				status({
					requestId: 502,
					status: 'CLIENT_CONSENT_DECLINED'
				})
			);
		const { rerender } = render(
			<CaseHandoverOfferGate
				actorId="recipient-a"
				sessionId={41}
				requestId={501}
				onClose={vi.fn()}
			>
				<div data-testid="normal-session">private</div>
			</CaseHandoverOfferGate>
		);
		expect(
			await screen.findByText('caseHandover.offer.denied')
		).toBeTruthy();
		expect(screen.queryByTestId('normal-session')).toBeNull();

		rerender(
			<CaseHandoverOfferGate
				actorId="recipient-a"
				sessionId={41}
				requestId={502}
				onClose={vi.fn()}
			>
				<div data-testid="normal-session">private</div>
			</CaseHandoverOfferGate>
		);
		expect(
			await screen.findByText('caseHandover.offer.clientConsentDeclined')
		).toBeTruthy();
		expect(screen.queryByTestId('normal-session')).toBeNull();
	});

	it('refreshes a pending scoped request when its exact resolution event arrives', async () => {
		vi.mocked(apiGetCaseHandoverRequestStatus)
			.mockResolvedValueOnce(status({ status: 'PENDING_CLIENT_CONSENT' }))
			.mockResolvedValueOnce(
				status({ status: 'GRANTED', canViewContent: true })
			);
		const gate = (notificationFeed: any[]) => (
			<NotificationsContext.Provider
				value={
					{
						notificationFeed,
						refreshNotificationFeed: vi.fn()
					} as any
				}
			>
				<CaseHandoverOfferGate
					actorId="recipient-a"
					sessionId={41}
					requestId={501}
					onClose={vi.fn()}
				>
					<div data-testid="normal-session">private</div>
				</CaseHandoverOfferGate>
			</NotificationsContext.Provider>
		);
		const { rerender } = render(gate([]));
		await screen.findByText('caseHandover.offer.awaitingClientConsent');

		rerender(
			gate([
				{
					id: 'event-1',
					eventType: 'case.handover.granted',
					sourceSessionId: '41',
					params: { caseHandoverRequestId: 501 }
				}
			])
		);

		expect(await screen.findByTestId('normal-session')).toBeTruthy();
		expect(apiGetCaseHandoverRequestStatus).toHaveBeenCalledTimes(2);
	});

	it('validates a backend-shaped null-request grant event through the scoped GET', async () => {
		vi.mocked(apiGetCaseHandoverRequestStatus)
			.mockResolvedValueOnce(status({ status: 'PENDING_CLIENT_CONSENT' }))
			.mockResolvedValueOnce(
				status({ status: 'GRANTED', canViewContent: true })
			);
		const gate = (notificationFeed: any[]) => (
			<NotificationsContext.Provider
				value={
					{
						notificationFeed,
						refreshNotificationFeed: vi.fn()
					} as any
				}
			>
				<CaseHandoverOfferGate
					actorId="recipient-a"
					sessionId={41}
					requestId={501}
					onClose={vi.fn()}
				>
					<div data-testid="normal-session">private</div>
				</CaseHandoverOfferGate>
			</NotificationsContext.Provider>
		);
		const { rerender } = render(gate([]));
		await screen.findByText('caseHandover.offer.awaitingClientConsent');

		rerender(
			gate([
				{
					id: 'actual-grant-event',
					eventType: 'case.handover.granted',
					sourceSessionId: '41',
					params: { caseHandoverRequestId: null }
				}
			])
		);

		expect(await screen.findByTestId('normal-session')).toBeTruthy();
		expect(apiGetCaseHandoverRequestStatus).toHaveBeenCalledTimes(2);
	});
});
