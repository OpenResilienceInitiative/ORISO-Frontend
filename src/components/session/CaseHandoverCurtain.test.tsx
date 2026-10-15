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
	apiGetCaseHandoverReasons,
	apiGetCaseHandoverStatus,
	apiRequestCaseHandoverAccess,
	type CaseHandoverStatus
} from '../../api/apiCaseHandover';
import { CaseHandoverCurtain } from './CaseHandoverCurtain';
import {
	getCaseHandoverOperation,
	resetCaseHandoverOperationStoreForTests
} from '../caseHandover/caseHandoverOperationStore';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

// caseHandoverHelpers reaches the global-state barrel, whose UI exports pull
// in lottie-web. The player is an external rendering boundary and jsdom has no
// canvas; the real curtain and handover helpers remain under test.
vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('../../api/apiCaseHandover', () => ({
	apiGetCaseHandoverReasons: vi.fn(),
	apiGetCaseHandoverStatus: vi.fn(),
	apiRequestCaseHandoverAccess: vi.fn()
}));

vi.mock('../../api/fetchData', () => ({
	FETCH_ERRORS: { CONFLICT: 'CONFLICT', FORBIDDEN: 'FORBIDDEN' }
}));

const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
};

const statusFor = (
	sessionId: number,
	canViewContent = true
): CaseHandoverStatus => ({
	sessionId,
	status: canViewContent ? 'GRANTED' : 'PENDING',
	canViewContent,
	clientConsentRequired: !canViewContent,
	ownershipRevision: 7,
	auditOutcome: canViewContent ? 'ACCESS_GRANTED' : 'CONSENT_REQUIRED'
});

const idleStatus = (sessionId: number): CaseHandoverStatus => ({
	sessionId,
	status: 'NOT_REQUESTED',
	canViewContent: false,
	clientConsentRequired: false,
	ownershipRevision: 7
});

const completeAndSubmitRequest = async (
	explanation = 'A concrete access reason'
) => {
	fireEvent.click(
		await screen.findByRole('button', {
			name: 'caseHandover.curtain.intro.cta'
		})
	);
	fireEvent.click(await screen.findByRole('radio'));
	fireEvent.click(
		screen.getByRole('button', {
			name: 'caseHandover.curtain.next'
		})
	);
	fireEvent.change(screen.getByRole('textbox'), {
		target: { value: explanation }
	});
	fireEvent.click(
		screen.getByRole('button', { name: 'caseHandover.submit' })
	);
};

describe('CaseHandoverCurtain request lifecycle', () => {
	beforeEach(() => {
		vi.mocked(apiGetCaseHandoverReasons).mockReset();
		vi.mocked(apiGetCaseHandoverStatus).mockReset();
		vi.mocked(apiRequestCaseHandoverAccess).mockReset();
		resetCaseHandoverOperationStoreForTests();
		vi.mocked(apiGetCaseHandoverReasons).mockResolvedValue([
			{
				code: 'SUPERVISION',
				label: 'Supervision',
				clientConsentRequired: false
			}
		]);
	});

	afterEach(() => {
		cleanup();
	});

	it('ignores a response for the previous case after the session changes', async () => {
		const firstRequest = deferred<CaseHandoverStatus>();
		vi.mocked(apiRequestCaseHandoverAccess).mockReturnValueOnce(
			firstRequest.promise
		);
		const firstStatusChange = vi.fn();
		const secondStatusChange = vi.fn();
		const { rerender } = render(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={1}
				status={idleStatus(1)}
				onStatusChange={firstStatusChange}
			/>
		);

		await completeAndSubmitRequest();
		expect(apiRequestCaseHandoverAccess).toHaveBeenCalledWith(
			1,
			'SUPERVISION',
			'A concrete access reason',
			7,
			expect.any(String)
		);

		rerender(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={2}
				status={idleStatus(2)}
				onStatusChange={secondStatusChange}
			/>
		);
		await screen.findByRole('button', {
			name: 'caseHandover.curtain.intro.cta'
		});

		await act(async () => {
			firstRequest.resolve(statusFor(1));
			await firstRequest.promise;
		});

		await waitFor(() => expect(firstStatusChange).not.toHaveBeenCalled());
		expect(secondStatusChange).not.toHaveBeenCalled();
		expect(
			screen.getByRole('button', {
				name: 'caseHandover.curtain.intro.cta'
			})
		).toBeDefined();
	});

	it('keeps the current case submitting when the previous request fails', async () => {
		const firstRequest = deferred<CaseHandoverStatus>();
		const secondRequest = deferred<CaseHandoverStatus>();
		vi.mocked(apiRequestCaseHandoverAccess)
			.mockReturnValueOnce(firstRequest.promise)
			.mockReturnValueOnce(secondRequest.promise);
		const firstStatusChange = vi.fn();
		const secondStatusChange = vi.fn();
		const { rerender } = render(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={1}
				status={idleStatus(1)}
				onStatusChange={firstStatusChange}
			/>
		);

		await completeAndSubmitRequest();
		rerender(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={2}
				status={idleStatus(2)}
				onStatusChange={secondStatusChange}
			/>
		);
		await completeAndSubmitRequest();
		const submitButton = screen.getByRole('button', {
			name: 'caseHandover.submit'
		});
		expect((submitButton as HTMLButtonElement).disabled).toBe(true);

		await act(async () => {
			firstRequest.reject(new Error('late failure for case A'));
			await firstRequest.promise.catch(() => undefined);
		});

		expect(screen.queryByRole('alert')).toBeNull();
		expect((submitButton as HTMLButtonElement).disabled).toBe(true);
		expect(firstStatusChange).not.toHaveBeenCalled();
		expect(secondStatusChange).not.toHaveBeenCalled();

		await act(async () => {
			secondRequest.resolve(statusFor(2));
			await secondRequest.promise;
		});

		await waitFor(() =>
			expect(secondStatusChange).toHaveBeenCalledWith(statusFor(2))
		);
	});

	it('shows the current case request error and restores submission', async () => {
		const currentRequest = deferred<CaseHandoverStatus>();
		vi.mocked(apiRequestCaseHandoverAccess).mockReturnValueOnce(
			currentRequest.promise
		);
		const onStatusChange = vi.fn();
		render(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={2}
				status={idleStatus(2)}
				onStatusChange={onStatusChange}
			/>
		);

		await completeAndSubmitRequest();
		await act(async () => {
			currentRequest.reject(new Error('FORBIDDEN'));
			await currentRequest.promise.catch(() => undefined);
		});

		expect((await screen.findByRole('alert')).textContent).toBe(
			'caseHandover.error.forbidden'
		);
		expect(
			(
				screen.getByRole('button', {
					name: 'caseHandover.submit'
				}) as HTMLButtonElement
			).disabled
		).toBe(false);
		expect(onStatusChange).not.toHaveBeenCalled();
	});

	it('invalidates a pending request when the curtain unmounts', async () => {
		const pendingRequest = deferred<CaseHandoverStatus>();
		vi.mocked(apiRequestCaseHandoverAccess).mockReturnValueOnce(
			pendingRequest.promise
		);
		const onStatusChange = vi.fn();
		const { unmount } = render(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={1}
				status={idleStatus(1)}
				onStatusChange={onStatusChange}
			/>
		);

		await completeAndSubmitRequest();
		unmount();
		await act(async () => {
			pendingRequest.resolve(statusFor(1));
			await pendingRequest.promise;
		});

		expect(onStatusChange).not.toHaveBeenCalled();
	});

	it('does not revive the first request after switching from A to B to A', async () => {
		const firstARequest = deferred<CaseHandoverStatus>();
		const secondARequest = deferred<CaseHandoverStatus>();
		vi.mocked(apiRequestCaseHandoverAccess)
			.mockReturnValueOnce(firstARequest.promise)
			.mockReturnValueOnce(secondARequest.promise);
		const firstAStatusChange = vi.fn();
		const bStatusChange = vi.fn();
		const secondAStatusChange = vi.fn();
		const { rerender } = render(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={1}
				status={idleStatus(1)}
				onStatusChange={firstAStatusChange}
			/>
		);

		await completeAndSubmitRequest();
		rerender(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={2}
				status={idleStatus(2)}
				onStatusChange={bStatusChange}
			/>
		);
		await screen.findByRole('button', {
			name: 'caseHandover.curtain.intro.cta'
		});
		rerender(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={1}
				status={idleStatus(1)}
				onStatusChange={secondAStatusChange}
			/>
		);
		fireEvent.click(
			await screen.findByRole('button', { name: 'caseHandover.submit' })
		);

		await act(async () => {
			firstARequest.resolve(statusFor(1));
			await firstARequest.promise;
		});

		expect(firstAStatusChange).not.toHaveBeenCalled();
		expect(bStatusChange).not.toHaveBeenCalled();
		expect(secondAStatusChange).not.toHaveBeenCalled();
		expect(
			(
				screen.getByRole('button', {
					name: 'caseHandover.submit'
				}) as HTMLButtonElement
			).disabled
		).toBe(true);

		await act(async () => {
			secondARequest.resolve(statusFor(1));
			await secondARequest.promise;
		});

		await waitFor(() =>
			expect(secondAStatusChange).toHaveBeenCalledWith(statusFor(1))
		);
	});

	it('rejects a current response that identifies a different case', async () => {
		const currentRequest = deferred<CaseHandoverStatus>();
		vi.mocked(apiRequestCaseHandoverAccess).mockReturnValueOnce(
			currentRequest.promise
		);
		const onStatusChange = vi.fn();
		render(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={2}
				status={idleStatus(2)}
				onStatusChange={onStatusChange}
			/>
		);

		await completeAndSubmitRequest();
		await act(async () => {
			currentRequest.resolve(statusFor(1));
			await currentRequest.promise;
		});

		expect(onStatusChange).not.toHaveBeenCalled();
		expect((await screen.findByRole('alert')).textContent).toBe(
			'caseHandover.error.failed'
		);
		expect(
			(
				screen.getByRole('button', {
					name: 'caseHandover.submit'
				}) as HTMLButtonElement
			).disabled
		).toBe(false);
	});

	it('replays the frozen PULL operation after remount despite a newer revision', async () => {
		vi.mocked(apiRequestCaseHandoverAccess)
			.mockRejectedValueOnce(new Error('NETWORK'))
			.mockResolvedValueOnce(statusFor(1));
		const firstStatusChange = vi.fn();
		const first = render(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={1}
				status={idleStatus(1)}
				onStatusChange={firstStatusChange}
			/>
		);

		await completeAndSubmitRequest('frozen intent');
		await screen.findByRole('alert');
		const firstCall = vi.mocked(apiRequestCaseHandoverAccess).mock.calls[0];
		first.unmount();

		const newerRevisionStatus = {
			...idleStatus(1),
			ownershipRevision: 99
		};
		const replayStatusChange = vi.fn();
		render(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={1}
				status={newerRevisionStatus}
				onStatusChange={replayStatusChange}
			/>
		);
		fireEvent.click(
			await screen.findByRole('button', { name: 'caseHandover.submit' })
		);

		await waitFor(() =>
			expect(apiRequestCaseHandoverAccess).toHaveBeenCalledTimes(2)
		);
		const replayCall = vi.mocked(apiRequestCaseHandoverAccess).mock
			.calls[1];
		expect(replayCall[2]).toBe('frozen intent');
		expect(replayCall[3]).toBe(firstCall[3]);
		expect(replayCall[4]).toBe(firstCall[4]);
		expect(replayStatusChange).toHaveBeenCalledWith(statusFor(1));
	});

	it('does not let a late conflict refresh clear the newer A operation', async () => {
		const staleRefresh = deferred<CaseHandoverStatus>();
		const secondARequest = deferred<CaseHandoverStatus>();
		vi.mocked(apiRequestCaseHandoverAccess)
			.mockRejectedValueOnce(new Error('CONFLICT'))
			.mockReturnValueOnce(secondARequest.promise);
		vi.mocked(apiGetCaseHandoverStatus).mockReturnValue(
			staleRefresh.promise
		);
		const { rerender } = render(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={1}
				status={idleStatus(1)}
				onStatusChange={vi.fn()}
			/>
		);
		await completeAndSubmitRequest('first intent');
		await waitFor(() =>
			expect(apiGetCaseHandoverStatus).toHaveBeenCalledWith(1)
		);

		rerender(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={2}
				status={idleStatus(2)}
				onStatusChange={vi.fn()}
			/>
		);
		rerender(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={1}
				status={idleStatus(1)}
				onStatusChange={vi.fn()}
			/>
		);
		fireEvent.change(await screen.findByRole('textbox'), {
			target: { value: 'new intent' }
		});
		fireEvent.click(
			screen.getByRole('button', { name: 'caseHandover.submit' })
		);
		const newerOperationId = vi.mocked(apiRequestCaseHandoverAccess).mock
			.calls[1][4];
		expect(
			getCaseHandoverOperation({
				actorId: 'consultant-1',
				sessionId: 1,
				kind: 'PULL'
			})?.operationId
		).toBe(newerOperationId);

		await act(async () => {
			staleRefresh.resolve(idleStatus(1));
			await staleRefresh.promise;
		});

		expect(screen.queryByRole('alert')).toBeNull();
		expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
			'new intent'
		);
		expect(
			getCaseHandoverOperation({
				actorId: 'consultant-1',
				sessionId: 1,
				kind: 'PULL'
			})?.operationId
		).toBe(newerOperationId);
	});
});
