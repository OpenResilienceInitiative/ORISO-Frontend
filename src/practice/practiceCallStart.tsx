import * as React from 'react';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../components/m3Dialog/M3Dialog';
import { getPracticeSnapshot, subscribePractice } from './practiceMode';
import { emitPracticeEvent, PRACTICE_TOUR_EVENTS } from './practiceTourEvents';

/*
 * FE#2545 D3: while practising, a call button starts no call. The real click
 * handler asks `isPracticeMode()` first and calls `simulatePracticeCallStart`
 * instead: no getUserMedia, no call manager, no request. A dialog says what
 * the real button does, and the tour hears that the counsellor used it. The
 * open dialog belongs to one practice run: a restart or an exit closes it.
 */
let openRunId: number | null = null;
const listeners = new Set<() => void>();

const currentRunId = (): number | null => {
	const snapshot = getPracticeSnapshot();
	return snapshot.status === 'active' ? snapshot.session.runId : null;
};

const notify = () => listeners.forEach((listener) => listener());

/** The simulated call start; does nothing outside practice. */
export const simulatePracticeCallStart = (): void => {
	const runId = currentRunId();
	if (runId === null) return;
	openRunId = runId;
	notify();
	// A macrotask later, like the click advance: the dialog is on screen
	// before the tour moves on.
	window.setTimeout(() => {
		if (currentRunId() === runId) {
			emitPracticeEvent(PRACTICE_TOUR_EVENTS.circleCallStarted);
		}
	}, 0);
};

export const closePracticeCallStart = (): void => {
	openRunId = null;
	notify();
};

const subscribe = (listener: () => void): (() => void) => {
	listeners.add(listener);
	const offPractice = subscribePractice(listener);
	return () => {
		listeners.delete(listener);
		offPractice();
	};
};

const isOpen = (): boolean =>
	openRunId !== null && openRunId === currentRunId();

/** Mounted once by the practice sandbox. */
export const PracticeCallStartDialog = () => {
	const { t: translate } = useTranslation();
	const open = useSyncExternalStore(subscribe, isOpen, () => false);
	// Practice mode keeps its banner reachable while a dialog is open.
	const practiceControls = open
		? document.querySelector<HTMLElement>('[data-practice-controls]')
		: null;
	return (
		<M3Dialog
			open={open}
			title={translate('practice.callStart.title')}
			description={translate('practice.callStart.description')}
			closeLabel={translate('app.close')}
			reachableOutside={practiceControls}
			onClose={closePracticeCallStart}
			actions={[
				{
					label: translate('practice.callStart.close'),
					onClick: closePracticeCallStart,
					primary: true,
					testId: 'practice-call-start-close'
				}
			]}
			data-testid="practice-call-start-dialog"
		/>
	);
};
