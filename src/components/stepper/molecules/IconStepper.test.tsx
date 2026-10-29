// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IconStepper } from './IconStepper';

const steps = ['topic-selection', 'zipcode', 'account-data'].map((name) => ({
	name,
	label: name,
	icon: <span />
}));

/**
 * ORISO-Frontend#1736. When every step is done the finished stepper is shown
 * for a beat before it folds away; on a narrow screen its row scrolls, so the
 * last step has to be brought into view even though none is active any more.
 */
describe('IconStepper — scrolling to where the person is', () => {
	const scrollIntoView = vi.fn();

	beforeEach(() => {
		scrollIntoView.mockClear();
		Element.prototype.scrollIntoView = scrollIntoView;
		window.matchMedia = (() => ({
			matches: false,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
			addListener: () => undefined,
			removeListener: () => undefined
		})) as unknown as typeof window.matchMedia;
	});
	afterEach(cleanup);

	const scrolledStep = () =>
		(
			scrollIntoView.mock.contexts.at(-1) as HTMLElement | undefined
		)?.getAttribute('data-cy');

	it('brings the active step into view', () => {
		render(<IconStepper steps={steps} currentStepName="zipcode" />);

		expect(scrolledStep()).toBe('icon-stepper-step-zipcode');
	});

	it('brings the last step into view once every step is done', () => {
		const { rerender } = render(
			<IconStepper steps={steps} currentStepName="account-data" />
		);
		scrollIntoView.mockClear();
		rerender(
			<IconStepper
				steps={steps}
				currentStepName="account-data"
				completed
			/>
		);

		expect(scrollIntoView).toHaveBeenCalledTimes(1);
		expect(scrolledStep()).toBe('icon-stepper-step-account-data');
	});
});
