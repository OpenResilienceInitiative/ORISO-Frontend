// @vitest-environment jsdom
/**
 * PLAN 2.2 — the "Fall abgeben" dialog must state whether the client will have
 * to consent, and must not let an incomplete offer be sent.
 *
 * This project has no jest-dom matchers, so the assertions read the DOM.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import {
	CaseHandoverGiveOverDialog,
	CaseHandoverGiveOverView,
	giveOverErrorMessage
} from './CaseHandoverGiveOverDialog';
import { FETCH_ERRORS } from '../../api/fetchData';
import {
	caseHandoverColleagueName,
	type CaseHandoverColleague,
	type CaseHandoverReason
} from '../../api/apiCaseHandover';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const apiMocks = vi.hoisted(() => ({
	apiGetCaseHandoverReasons: vi.fn(),
	apiGetCaseHandoverColleagues: vi.fn(),
	apiCreateCaseHandoverOffer: vi.fn()
}));

vi.mock('../../api/apiCaseHandover', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api/apiCaseHandover')>()),
	...apiMocks
}));

const colleagues: CaseHandoverColleague[] = [
	{
		consultantId: 'c-1',
		username: 'bettina.sommer',
		displayName: 'Bettina Sommer',
		firstName: 'Bettina',
		lastName: 'Sommer',
		absent: false
	},
	{
		consultantId: 'c-2',
		username: 'kim.grothe',
		displayName: 'Kim Grothe',
		firstName: 'Kim',
		lastName: 'Grothe',
		absent: true
	}
];

/** Stand-in for i18next's `t`: echoes the key it was asked for. */
const echoTranslate = vi.fn((key: string) => key) as any;

const reasons: CaseHandoverReason[] = [
	{
		code: 'ADVICE_REQUESTED',
		label: 'Advice requested',
		clientConsentRequired: true
	},
	{
		code: 'PLANNED_ABSENCE',
		label: 'Planned absence',
		clientConsentRequired: false
	}
];

const submitButton = () =>
	screen.getByTestId('case-handover-give-over-submit') as HTMLButtonElement;

const renderView = (
	overrides: Partial<
		React.ComponentProps<typeof CaseHandoverGiveOverView>
	> = {}
) => {
	const props = {
		colleagues,
		query: '',
		onQueryChange: vi.fn(),
		selectedColleagueId: '',
		onColleagueSelect: vi.fn(),
		reasons,
		reasonCode: '',
		onReasonSelect: vi.fn(),
		onSubmit: vi.fn(),
		onClose: vi.fn(),
		...overrides
	};
	render(<CaseHandoverGiveOverView {...props} />);
	return props;
};

afterEach(cleanup);

describe('CaseHandoverGiveOverView', () => {
	it.each(['CO_ACCESS', 'TAKEOVER'] as const)(
		'describes the server-provided %s effect independently of the reason code',
		(accessType) => {
			renderView({
				reasonCode: 'CUSTOM_REASON',
				reasons: [
					{
						code: 'CUSTOM_REASON',
						label: 'Custom',
						accessType,
						clientConsentRequired: true
					}
				]
			});
			expect(submitButton().textContent).toBe(
				accessType === 'CO_ACCESS'
					? 'caseHandover.giveOver.coAccessSubmit'
					: 'caseHandover.giveOver.submit'
			);
			expect(
				screen.getByText(
					accessType === 'CO_ACCESS'
						? 'caseHandover.curtain.consentPending'
						: 'caseHandover.giveOver.consentHint'
				)
			).toBeTruthy();
		}
	);
	it('keeps the offer button disabled until colleague and reason are set', () => {
		renderView();
		expect(submitButton().disabled).toBe(true);

		cleanup();
		renderView({ selectedColleagueId: 'c-1' });
		expect(submitButton().disabled).toBe(true);

		cleanup();
		renderView({
			selectedColleagueId: 'c-1',
			reasonCode: 'PLANNED_ABSENCE'
		});
		expect(submitButton().disabled).toBe(false);
	});

	it('announces the client consent from the reason policy, not from the code', () => {
		renderView({
			selectedColleagueId: 'c-1',
			reasonCode: 'ADVICE_REQUESTED'
		});
		expect(
			screen.getByText('caseHandover.giveOver.consentHint')
		).toBeTruthy();

		cleanup();
		renderView({
			selectedColleagueId: 'c-1',
			reasonCode: 'PLANNED_ABSENCE'
		});
		expect(
			screen.getByText('caseHandover.giveOver.noConsentHint')
		).toBeTruthy();
	});

	it('says nothing about consent while no reason is chosen', () => {
		renderView({ selectedColleagueId: 'c-1' });
		expect(
			screen.queryByText('caseHandover.giveOver.consentHint')
		).toBeNull();
		expect(
			screen.queryByText('caseHandover.giveOver.noConsentHint')
		).toBeNull();
	});

	it('reports the picked colleague and reason back to the caller', () => {
		const props = renderView();
		fireEvent.click(screen.getByRole('radio', { name: /Kim Grothe/ }));
		expect(props.onColleagueSelect).toHaveBeenCalledWith('c-2');

		fireEvent.click(
			screen.getByRole('radio', {
				name: /caseHandover\.reason\.PLANNED_ABSENCE/
			})
		);
		expect(props.onReasonSelect).toHaveBeenCalledWith('PLANNED_ABSENCE');
	});

	it('shows the empty state rather than a stale list when nobody matches', () => {
		renderView({ colleagues: [] });
		expect(
			screen.getByText('caseHandover.giveOver.colleague.empty')
		).toBeTruthy();
	});

	it('marks an absent colleague instead of an agency the contract never sends', () => {
		renderView();
		expect(
			screen.getByText('caseHandover.giveOver.colleague.absent')
		).toBeTruthy();
	});

	it('surfaces an error as an alert', () => {
		renderView({ error: 'boom' });
		expect(screen.getByRole('alert').textContent).toContain('boom');
	});
});

describe('caseHandoverColleagueName', () => {
	it('prefers the display name the server computed', () => {
		expect(caseHandoverColleagueName(colleagues[0])).toBe('Bettina Sommer');
	});

	it('falls back down the ladder rather than showing a blank row', () => {
		expect(
			caseHandoverColleagueName({
				consultantId: 'c-9',
				firstName: 'Ali',
				lastName: 'Yildiz'
			})
		).toBe('Ali Yildiz');
		expect(
			caseHandoverColleagueName({
				consultantId: 'c-9',
				username: 'ali.yildiz'
			})
		).toBe('ali.yildiz');
		expect(caseHandoverColleagueName({ consultantId: 'c-9' })).toBe('c-9');
	});
});

describe('giveOverErrorMessage', () => {
	it('names the situation the contract reports', () => {
		expect(giveOverErrorMessage(echoTranslate, FETCH_ERRORS.CONFLICT)).toBe(
			'caseHandover.giveOver.error.conflict'
		);
		expect(
			giveOverErrorMessage(echoTranslate, FETCH_ERRORS.FORBIDDEN)
		).toBe('caseHandover.giveOver.error.forbidden');
		expect(giveOverErrorMessage(echoTranslate, FETCH_ERRORS.NO_MATCH)).toBe(
			'caseHandover.giveOver.error.notFound'
		);
		expect(giveOverErrorMessage(echoTranslate, undefined)).toBe(
			'caseHandover.giveOver.error.failed'
		);
	});
});

describe('CaseHandoverGiveOverDialog (wired)', () => {
	const openDialog = () => {
		apiMocks.apiGetCaseHandoverReasons.mockResolvedValue(reasons);
		apiMocks.apiGetCaseHandoverColleagues.mockResolvedValue({
			colleagues,
			total: 2,
			offset: 0,
			count: 25
		});
		apiMocks.apiCreateCaseHandoverOffer.mockResolvedValue({
			offerId: 1,
			sessionId: 42,
			status: 'PENDING_RECIPIENT_ACCEPT',
			direction: 'PUSH'
		});
		render(
			<CaseHandoverGiveOverDialog sessionId={42} open onClose={vi.fn()} />
		);
	};

	it('asks for colleagues with the contract query parameters', async () => {
		openDialog();
		await waitFor(() =>
			expect(apiMocks.apiGetCaseHandoverColleagues).toHaveBeenCalled()
		);
		expect(
			apiMocks.apiGetCaseHandoverColleagues.mock.calls[0][0]
		).toMatchObject({ sessionId: 42, query: '' });
	});

	it('reads the colleagues out of the list envelope, not out of an array', async () => {
		openDialog();
		expect(
			await screen.findByRole('radio', { name: /Kim Grothe/ })
		).toBeTruthy();
	});

	it('sends the staff-only explanation the contract requires', async () => {
		openDialog();
		fireEvent.click(
			await screen.findByRole('radio', { name: /Bettina Sommer/ })
		);
		fireEvent.click(
			screen.getByRole('radio', {
				name: /caseHandover\.reason\.PLANNED_ABSENCE/
			})
		);
		fireEvent.click(screen.getByTestId('case-handover-give-over-submit'));

		await waitFor(() =>
			expect(apiMocks.apiCreateCaseHandoverOffer).toHaveBeenCalledWith({
				sessionId: 42,
				targetConsultantId: 'c-1',
				reasonCode: 'PLANNED_ABSENCE',
				explanation: 'caseHandover.reason.PLANNED_ABSENCE'
			})
		);
	});
});
