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
import { subscribeToTourEvent } from '../components/productTour/tourEvents';
import {
	enterPracticeMode,
	exitPracticeMode,
	restartPracticeMode
} from './practiceMode';
import {
	PracticeCallStartDialog,
	simulatePracticeCallStart
} from './practiceCallStart';
import { PRACTICE_TOUR_EVENTS } from './practiceTourEvents';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const TOUR = 'consultant-group-circle';
const macrotask = () =>
	act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
/** MUI keeps the sheet for its exit transition. */
const closed = () =>
	waitFor(() =>
		expect(screen.queryByText('practice.callStart.title')).toBeNull()
	);
const dialog = () => screen.queryByTestId('practice-call-start-dialog');

describe('the simulated call start (FE#2545 D3)', () => {
	let starts = 0;
	let stop = () => undefined as void;
	beforeEach(() => {
		starts = 0;
		stop = subscribeToTourEvent(
			PRACTICE_TOUR_EVENTS.circleCallStarted,
			() => {
				starts += 1;
			}
		);
	});
	afterEach(() => {
		stop();
		cleanup();
		exitPracticeMode();
	});

	it('does nothing outside practice', async () => {
		render(<PracticeCallStartDialog />);
		act(() => simulatePracticeCallStart());
		await macrotask();
		expect(dialog()).toBeNull();
		expect(starts).toBe(0);
	});

	it('shows what the real button does, tells the tour, and closes with its one button', async () => {
		enterPracticeMode({ tourId: TOUR });
		render(<PracticeCallStartDialog />);

		act(() => simulatePracticeCallStart());
		await macrotask();

		expect(screen.getByText('practice.callStart.title')).toBeTruthy();
		expect(screen.getByText('practice.callStart.description')).toBeTruthy();
		expect(starts).toBe(1);
		fireEvent.click(screen.getByTestId('practice-call-start-close'));
		await closed();
	});

	it('belongs to one run: a restart or the exit closes it', async () => {
		enterPracticeMode({ tourId: TOUR });
		render(<PracticeCallStartDialog />);
		act(() => simulatePracticeCallStart());
		await macrotask();
		expect(screen.queryByText('practice.callStart.title')).toBeTruthy();

		act(() => restartPracticeMode());
		await closed();

		act(() => simulatePracticeCallStart());
		await macrotask();
		act(() => exitPracticeMode());
		await closed();
	});
});
