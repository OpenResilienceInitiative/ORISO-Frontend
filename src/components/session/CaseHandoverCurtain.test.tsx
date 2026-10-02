// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaseHandoverCurtain } from './CaseHandoverCurtain';
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

		render(
			<CaseHandoverCurtain
				sessionId={5}
				status={statusFor({ canReclaim: true })}
				onStatusChange={onStatusChange}
			/>
		);
		fireEvent.click(reclaimButton()!);

		await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith(owned));
		expect(apiReclaimCaseHandover).toHaveBeenCalledWith(5);
	});

	it('offers no reclaim when the backend says the takeover cannot be reclaimed', () => {
		render(
			<CaseHandoverCurtain
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
				sessionId={5}
				status={statusFor({ status: 'DENIED', canReclaim: true })}
				onStatusChange={vi.fn()}
			/>
		);

		expect(reclaimButton()).not.toBeNull();
	});
});
