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
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CaseHandoverCurtain } from './CaseHandoverCurtain';
import { ActiveSessionProvider } from '../../globalState/provider/ActiveSessionProvider';
import {
	apiReclaimCaseHandover,
	CaseHandoverStatus
} from '../../api/apiCaseHandover';

vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('react-i18next', () => {
	const t = (key: string) => key;
	return { useTranslation: () => ({ t }) };
});

vi.mock('../../api/apiCaseHandover', () => ({
	apiGetCaseHandoverReasons: vi.fn(() => Promise.resolve([])),
	apiGetCaseHandoverStatus: vi.fn(),
	apiRequestCaseHandoverAccess: vi.fn(),
	apiReclaimCaseHandover: vi.fn()
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const statusFor = (
	overrides: Partial<CaseHandoverStatus>
): CaseHandoverStatus => ({
	sessionId: 5,
	status: 'NOT_REQUESTED',
	canViewContent: false,
	clientConsentRequired: false,
	...overrides
});

const reclaimButton = () =>
	screen.queryByRole('button', { name: 'caseHandover.curtain.reclaim.cta' });

describe('CaseHandoverCurtain reclaim', () => {
	it('lets the original counsellor take the case back after a takeover', async () => {
		const owned = statusFor({ status: 'GRANTED', canViewContent: true });
		vi.mocked(apiReclaimCaseHandover).mockResolvedValue(owned);
		const onStatusChange = vi.fn();
		const refreshActiveSession = vi
			.fn()
			.mockRejectedValue(new Error('temporary connection loss'));

		render(
			<ActiveSessionProvider
				activeSession={null}
				refreshActiveSession={refreshActiveSession}
			>
				<CaseHandoverCurtain
					actorId="consultant-1"
					sessionId={5}
					status={statusFor({ canReclaim: true })}
					onStatusChange={onStatusChange}
				/>
			</ActiveSessionProvider>
		);
		fireEvent.click(reclaimButton()!);

		await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith(owned));
		expect(apiReclaimCaseHandover).toHaveBeenCalledWith(5);
		expect(refreshActiveSession).toHaveBeenCalledTimes(1);
		expect(screen.queryByText('caseHandover.error.failed')).toBeNull();
	});

	it('does not apply a late reclaim response after switching cases', async () => {
		let finishReclaim: (status: CaseHandoverStatus) => void;
		vi.mocked(apiReclaimCaseHandover).mockReturnValue(
			new Promise((resolve) => {
				finishReclaim = resolve;
			})
		);
		const onStatusChange = vi.fn();
		const refreshActiveSession = vi.fn();
		const curtain = (sessionId: number) => (
			<ActiveSessionProvider
				activeSession={null}
				refreshActiveSession={refreshActiveSession}
			>
				<CaseHandoverCurtain
					actorId="consultant-1"
					sessionId={sessionId}
					status={statusFor({ sessionId, canReclaim: true })}
					onStatusChange={onStatusChange}
				/>
			</ActiveSessionProvider>
		);
		const { rerender } = render(curtain(5));
		fireEvent.click(reclaimButton()!);
		rerender(curtain(6));

		await act(async () =>
			finishReclaim(
				statusFor({ status: 'GRANTED', canViewContent: true })
			)
		);

		expect(onStatusChange).not.toHaveBeenCalled();
		expect(refreshActiveSession).not.toHaveBeenCalled();
	});

	it('keeps access gated and skips refresh when reclaim fails', async () => {
		vi.mocked(apiReclaimCaseHandover).mockRejectedValue(
			new Error('network unavailable')
		);
		const onStatusChange = vi.fn();
		const refreshActiveSession = vi.fn();

		render(
			<ActiveSessionProvider
				activeSession={null}
				refreshActiveSession={refreshActiveSession}
			>
				<CaseHandoverCurtain
					actorId="consultant-1"
					sessionId={5}
					status={statusFor({ canReclaim: true })}
					onStatusChange={onStatusChange}
				/>
			</ActiveSessionProvider>
		);
		fireEvent.click(reclaimButton()!);

		await screen.findByText('caseHandover.error.failed');
		expect(onStatusChange).not.toHaveBeenCalled();
		expect(refreshActiveSession).not.toHaveBeenCalled();
	});

	it('offers no reclaim when the backend says the takeover cannot be reclaimed', () => {
		render(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={5}
				status={statusFor({ canReclaim: false })}
				onStatusChange={vi.fn()}
			/>
		);

		expect(reclaimButton()).toBeNull();
	});

	it('still offers reclaim when an earlier access request of theirs was denied', () => {
		render(
			<CaseHandoverCurtain
				actorId="consultant-1"
				sessionId={5}
				status={statusFor({ status: 'DENIED', canReclaim: true })}
				onStatusChange={vi.fn()}
			/>
		);

		expect(reclaimButton()).not.toBeNull();
	});
});
