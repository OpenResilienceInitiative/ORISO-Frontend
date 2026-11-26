// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { CaseHandoverExplanationLevel } from '../../api/apiCaseHandover';
import { CaseHandoverCurtainView } from './CaseHandoverCurtain';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

const noop = () => {};

/** FE#2040: one screen with the reason and, depending on its level, the explanation. */
const renderWithLevel = (
	explanationLevel: CaseHandoverExplanationLevel | undefined,
	explanation = '',
	onSubmit = vi.fn()
) => {
	render(
		<CaseHandoverCurtainView
			step="reason"
			reasons={[
				{
					code: 'PLANNED_ABSENCE',
					label: 'Planned absence',
					clientConsentRequired: false,
					explanationLevel
				}
			]}
			reasonCode="PLANNED_ABSENCE"
			explanation={explanation}
			onStart={noop}
			onBack={noop}
			onNext={noop}
			onReasonSelect={noop}
			onExplanationChange={noop}
			onSubmit={onSubmit}
		/>
	);
	return {
		send: screen.getByRole('button', { name: 'caseHandover.submit' }),
		onSubmit
	};
};

describe('CaseHandoverCurtainView explanation level (FE#2040)', () => {
	it('OFF (also when absent): no text field, sending works', () => {
		const { send, onSubmit } = renderWithLevel(undefined);

		expect(screen.queryByRole('textbox')).toBeNull();
		fireEvent.click(send);
		expect(onSubmit).toHaveBeenCalled();
	});

	it('OPTIONAL: labelled optional, sending works while empty', () => {
		const { send, onSubmit } = renderWithLevel('OPTIONAL');

		expect(
			screen.getByLabelText('caseHandover.explanation.optional')
		).toBeTruthy();
		fireEvent.click(send);
		expect(onSubmit).toHaveBeenCalled();
	});

	it('REQUIRED: sending stays disabled until text is entered', () => {
		const { send } = renderWithLevel('REQUIRED');

		expect(
			screen.getByLabelText(/caseHandover\.explanation\.required/)
		).toBeTruthy();
		expect((send as HTMLButtonElement).disabled).toBe(true);
	});

	it('REQUIRED with text: sending is enabled', () => {
		const { send } = renderWithLevel('REQUIRED', 'Cover during holiday');

		expect((send as HTMLButtonElement).disabled).toBe(false);
	});
});
