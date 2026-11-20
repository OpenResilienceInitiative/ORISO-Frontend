// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import type { CaseHandoverStatus } from '../../api/apiCaseHandover';
import {
	TimelineConsentActions,
	type TimelineConsentDecisions
} from './TimelineConsentActions';

const { readStatus, decide } = vi.hoisted(() => ({
	readStatus: vi.fn(),
	decide: vi.fn()
}));
vi.mock('../../api/apiCaseHandover', async (original) => ({
	...(await original<typeof import('../../api/apiCaseHandover')>()),
	apiGetCaseHandoverRequestStatus: readStatus,
	apiDecideCaseHandoverClientConsent: decide
}));
vi.mock('../../api/fetchData', () => ({
	FETCH_ERRORS: {
		ABORT: 'ABORT',
		FORBIDDEN: 'FORBIDDEN',
		NO_MATCH: 'NO_MATCH',
		UNAUTHORIZED: 'UNAUTHORIZED',
		X_REASON: 'X-Reason'
	},
	X_REASON: { CASE_OWNER_CHANGED: 'CASE_OWNER_CHANGED' }
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const status = (
	value: CaseHandoverStatus['status'],
	requestId = 42,
	sessionId = 103
): CaseHandoverStatus => ({
	status: value,
	sessionId,
	requestId,
	canViewContent: false,
	clientConsentRequired: true
});
const pending = status('PENDING_CLIENT_CONSENT');
const terminal = status('CLIENT_CONSENT_DECLINED');
const approve = 'caseHandover.consent.approve';
const decline = 'caseHandover.consent.decline';
const readError = 'caseHandover.offer.generic';
const retryRead = 'caseHandover.offer.retry';
const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((complete) => {
		resolve = complete;
	});
	return { promise, resolve };
};

const setup = () => {
	const pendingDecisions: TimelineConsentDecisions = new Map();
	const onConfirmed = vi.fn();
	const element = (
		requestId: number,
		row = String(requestId),
		accountId = 'asker'
	) => (
		<TimelineConsentActions
			key={`${accountId}:${row}`}
			accountId={accountId}
			sessionId={103}
			requestId={requestId}
			pendingDecisions={pendingDecisions}
			onConfirmed={onConfirmed}
		/>
	);
	const view = render(element(42));
	return {
		...view,
		onConfirmed,
		select: (requestId: number, row?: string, accountId?: string) =>
			view.rerender(element(requestId, row, accountId))
	};
};

describe('Timeline consent actions', () => {
	beforeEach(() => {
		readStatus.mockReset();
		decide.mockReset();
	});
	afterEach(cleanup);

	it.each([
		terminal,
		status('PENDING_RECIPIENT_ACCEPTANCE'),
		status('FUTURE_STATUS'),
		status('PENDING', 43),
		status('PENDING', 42, 104),
		{ ...pending, requestId: undefined },
		{}
	])(
		'keeps unconfirmed or ineligible status $status historical',
		async (response) => {
			readStatus.mockResolvedValue(response);
			setup();
			await act(async () => {});
			expect(readStatus).toHaveBeenCalledWith(103, 42);
			expect(screen.queryByRole('button', { name: approve })).toBeNull();
			expect(screen.queryByRole('button', { name: decline })).toBeNull();
			const closed = screen.queryByText(
				'caseHandover.consent.info.closed'
			);
			expect(Boolean(closed)).toBe(response === terminal);
			expect(screen.queryByRole('alert')).toBeNull();
			expect(
				screen.queryByRole('button', { name: retryRead })
			).toBeNull();
			expect(decide).not.toHaveBeenCalled();
		}
	);

	it.each(['FORBIDDEN', 'NO_MATCH', 'UNAUTHORIZED', 'ABORT'])(
		'quietly withholds decisions when the status read returns %s',
		async (error) => {
			readStatus.mockRejectedValue(new Error(error));
			setup();
			await act(async () => {});
			expect(screen.queryByRole('status')).toBeNull();
			expect(screen.queryByRole('alert')).toBeNull();
			expect(screen.queryByRole('button', { name: approve })).toBeNull();
			expect(
				screen.queryByRole('button', { name: retryRead })
			).toBeNull();
			expect(decide).not.toHaveBeenCalled();
		}
	);

	it.each([
		new TypeError('Failed to fetch'),
		new Error('CATCH_ALL'),
		new Error('TIMEOUT')
	])('retries only the exact status read after %s', async (error) => {
		const retry = deferred<CaseHandoverStatus>();
		readStatus
			.mockRejectedValueOnce(error)
			.mockReturnValueOnce(retry.promise);
		const { onConfirmed } = setup();
		expect((await screen.findByRole('alert')).textContent).toBe(readError);
		expect(screen.queryByRole('button', { name: approve })).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: retryRead }));
		expect(screen.getByRole('status').textContent).toBe('app.wait');
		expect(screen.queryByRole('button', { name: decline })).toBeNull();
		expect(screen.queryByRole('button', { name: retryRead })).toBeNull();
		await act(async () => retry.resolve(pending));
		expect(screen.getByRole('button', { name: approve })).toBeTruthy();
		expect(screen.queryByRole('alert')).toBeNull();
		expect(readStatus.mock.calls).toEqual([
			[103, 42],
			[103, 42]
		]);
		expect(decide).not.toHaveBeenCalled();
		expect(onConfirmed).not.toHaveBeenCalled();
	});

	it.each([
		'PENDING',
		'PENDING_CLIENT_CONSENT',
		'GRANTED_PENDING_CLIENT_OPTOUT'
	])(
		'allows a confirmed decision in %s and removes it after settlement',
		async (value) => {
			readStatus.mockResolvedValue(status(value));
			decide.mockResolvedValue(terminal);
			const { onConfirmed } = setup();
			expect(screen.queryByRole('button', { name: decline })).toBeNull();
			fireEvent.click(
				await screen.findByRole('button', { name: decline })
			);
			await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
			expect(decide).toHaveBeenCalledExactlyOnceWith(103, 42, false);
			expect(screen.queryByRole('button', { name: decline })).toBeNull();
		}
	);

	it('ignores a late status read after selecting another request', async () => {
		const previous = deferred<CaseHandoverStatus>();
		readStatus
			.mockReturnValueOnce(previous.promise)
			.mockResolvedValueOnce(status('EXPIRED', 43));
		const { select } = setup();
		select(43);
		await act(async () => previous.resolve(pending));
		expect(screen.queryByRole('button', { name: approve })).toBeNull();
		expect(decide).not.toHaveBeenCalled();
	});

	it('guards both decision buttons and observes the same operation after reselecting the request', async () => {
		const response = deferred<CaseHandoverStatus>();
		readStatus.mockImplementation((_sessionId, requestId) =>
			Promise.resolve(requestId === 42 ? pending : status('EXPIRED', 43))
		);
		decide.mockReturnValue(response.promise);
		const { select, onConfirmed } = setup();
		const approveButton = await screen.findByRole<HTMLButtonElement>(
			'button',
			{ name: approve }
		);
		const declineButton = screen.getByRole<HTMLButtonElement>('button', {
			name: decline
		});
		act(() => {
			fireEvent.click(approveButton);
			fireEvent.click(declineButton);
		});
		expect(approveButton.disabled).toBe(true);
		expect(declineButton.disabled).toBe(true);
		expect(decide).toHaveBeenCalledExactlyOnceWith(103, 42, true);

		select(43);
		select(42, 'duplicate history row');
		expect(screen.queryByRole('button', { name: approve })).toBeNull();
		expect(
			readStatus.mock.calls.filter(([, requestId]) => requestId === 42)
		).toHaveLength(1);
		await act(async () => response.resolve(terminal));
		expect(screen.queryByRole('button', { name: approve })).toBeNull();
		expect(
			screen.getByText('caseHandover.consent.info.closed')
		).toBeTruthy();
		expect(onConfirmed).toHaveBeenCalledTimes(1);
		expect(decide).toHaveBeenCalledTimes(1);
	});

	it('keeps a former account’s late decision out of the new account’s feed', async () => {
		const response = deferred<CaseHandoverStatus>();
		readStatus.mockResolvedValue(pending);
		decide.mockReturnValue(response.promise);
		const { select, onConfirmed } = setup();
		fireEvent.click(await screen.findByRole('button', { name: approve }));
		select(42, '42', 'another asker');
		await screen.findByRole('button', { name: approve });

		await act(async () => response.resolve(terminal));
		expect(screen.getByRole('button', { name: approve })).toBeTruthy();
		expect(
			screen.queryByText('caseHandover.consent.info.closed')
		).toBeNull();
		expect(onConfirmed).not.toHaveBeenCalled();
		expect(readStatus).toHaveBeenCalledTimes(2);
	});

	it('closes an owner-changed conflict without reading the status again', async () => {
		readStatus.mockResolvedValue(pending);
		decide.mockRejectedValue(
			new Response(null, {
				status: 409,
				headers: { 'X-Reason': 'CASE_OWNER_CHANGED' }
			})
		);
		const { onConfirmed } = setup();
		fireEvent.click(await screen.findByRole('button', { name: approve }));
		expect(
			await screen.findByText('caseHandover.consent.info.closed')
		).toBeTruthy();
		expect(screen.queryByRole('button', { name: decline })).toBeNull();
		expect(readStatus).toHaveBeenCalledExactlyOnceWith(103, 42);
		expect(onConfirmed).toHaveBeenCalledTimes(1);
	});

	it('keeps a successful but still-open decision actionable without confirming settlement', async () => {
		readStatus.mockResolvedValue(pending);
		decide.mockResolvedValue(pending);
		const { onConfirmed } = setup();
		fireEvent.click(await screen.findByRole('button', { name: approve }));
		expect((await screen.findByRole('alert')).textContent).toBe(
			'caseHandover.error.failed'
		);
		expect(
			screen.getByRole<HTMLButtonElement>('button', { name: decline })
				.disabled
		).toBe(false);
		expect(screen.queryByRole('button', { name: retryRead })).toBeNull();
		expect(readStatus).toHaveBeenCalledExactlyOnceWith(103, 42);
		expect(onConfirmed).not.toHaveBeenCalled();
	});

	it('reconciles a rejected decision with the current terminal status', async () => {
		readStatus
			.mockResolvedValueOnce(pending)
			.mockResolvedValueOnce(terminal);
		decide.mockRejectedValue(new Error('network'));
		const { onConfirmed } = setup();
		fireEvent.click(await screen.findByRole('button', { name: approve }));
		await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
		expect(readStatus).toHaveBeenCalledTimes(2);
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByRole('button', { name: decline })).toBeNull();
	});

	it('allows retry only if a status read confirms the request is still open', async () => {
		readStatus.mockResolvedValue(pending);
		decide.mockRejectedValue(new Error('network'));
		const { onConfirmed } = setup();
		fireEvent.click(await screen.findByRole('button', { name: approve }));
		expect(await screen.findByRole('alert')).toBeTruthy();
		expect(
			screen.getByRole<HTMLButtonElement>('button', { name: decline })
				.disabled
		).toBe(false);
		expect(onConfirmed).not.toHaveBeenCalled();
	});
});
