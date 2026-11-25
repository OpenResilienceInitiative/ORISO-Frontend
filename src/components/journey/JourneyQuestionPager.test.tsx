// @vitest-environment oriso-jsdom
import * as React from 'react';
import { useState } from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { JourneyQuestionPager } from './JourneyQuestionPager';
import {
	emptyAnswers,
	type JourneyStep,
	type StepAnswers
} from './journeyModel';
import { flightStep, situationStep } from './journeyFixtures';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, vars?: { current?: number }) =>
			vars?.current === undefined ? key : `${key} ${vars.current}`
	})
}));

const Harness = ({ step }: { step: JourneyStep }) => {
	const [answers, setAnswers] = useState<StepAnswers>(emptyAnswers);
	return (
		<JourneyQuestionPager
			step={step}
			answers={answers}
			language="de"
			onChange={setAnswers}
		/>
	);
};

const progress = () =>
	screen.getByText(/journey\.checkIn\.progress/).textContent;

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('the check-in moves on by itself (#2333)', () => {
	it('waits, then shows the next question after a one-tap answer', () => {
		vi.useFakeTimers();
		render(<Harness step={situationStep} />);
		fireEvent.click(
			screen.getByRole('radio', { name: 'Mahnungen oder Inkasso' })
		);
		expect(progress()).toBe('journey.checkIn.progress 1');
		act(() => {
			vi.advanceTimersByTime(380);
		});
		expect(progress()).toBe('journey.checkIn.progress 2');
	});

	it('stays put when the person switches to "Etwas anderes" during that pause', () => {
		vi.useFakeTimers();
		render(<Harness step={situationStep} />);
		fireEvent.click(
			screen.getByRole('radio', { name: 'Mahnungen oder Inkasso' })
		);
		fireEvent.click(
			screen.getByRole('radio', { name: 'journey.question.other' })
		);
		act(() => {
			vi.advanceTimersByTime(400);
		});
		expect(progress()).toBe('journey.checkIn.progress 1');
	});

	it('starts again at the first question when the step changes', () => {
		vi.useFakeTimers();
		const { rerender } = render(<Harness step={situationStep} />);
		fireEvent.click(
			screen.getByRole('radio', { name: 'Mahnungen oder Inkasso' })
		);
		act(() => {
			vi.advanceTimersByTime(380);
		});
		expect(progress()).toBe('journey.checkIn.progress 2');
		rerender(<Harness step={flightStep} />);
		expect(progress()).toBe('journey.checkIn.progress 1');
	});
});
