// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaseHandoverCurtainView } from './CaseHandoverCurtain';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => `t:${key}` })
}));

afterEach(cleanup);

const noop = () => {};

describe('CaseHandoverCurtainView reason list', () => {
	it('shows the translated catalogue label, not the server wording', () => {
		render(
			<CaseHandoverCurtainView
				step="reason"
				reasons={[
					{
						code: 'PLANNED_ABSENCE',
						label: 'Counsellor is on holiday',
						clientConsentRequired: false
					},
					{
						code: 'TENANT_SPECIFIC',
						label: 'Sonderfall',
						clientConsentRequired: false
					}
				]}
				reasonCode=""
				explanation=""
				onStart={noop}
				onBack={noop}
				onNext={noop}
				onReasonSelect={noop}
				onExplanationChange={noop}
				onSubmit={noop}
			/>
		);

		expect(
			screen.getByText('t:caseHandover.reason.PLANNED_ABSENCE')
		).toBeTruthy();
		expect(screen.getByText('Sonderfall')).toBeTruthy();
		expect(screen.queryByText('Counsellor is on holiday')).toBeNull();
	});

	// An unmigrated tenant may still send retired codes: neutral and distinct.
	it('shows retired codes as distinct neutral successors', () => {
		render(
			<CaseHandoverCurtainView
				step="reason"
				reasons={[
					{
						code: 'COUNSELLOR_IS_ILL',
						label: 'Counsellor is ill',
						clientConsentRequired: false
					},
					{
						code: 'COUNSELLOR_ON_HOLIDAY',
						label: 'Counsellor is on holiday',
						clientConsentRequired: false
					}
				]}
				reasonCode=""
				explanation=""
				onStart={noop}
				onBack={noop}
				onNext={noop}
				onReasonSelect={noop}
				onExplanationChange={noop}
				onSubmit={noop}
			/>
		);

		expect(
			screen.getByText('t:caseHandover.reason.UNPLANNED_ABSENCE')
		).toBeTruthy();
		expect(
			screen.getByText('t:caseHandover.reason.PLANNED_ABSENCE')
		).toBeTruthy();
		expect(screen.queryByText('Counsellor is ill')).toBeNull();
	});
});
