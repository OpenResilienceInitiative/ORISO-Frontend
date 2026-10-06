/**
 * What real components outside `src/practice` use, plus the lifecycle the
 * README documents. Everything else is imported from its own file.
 */
export { usePracticeActive } from './usePracticeActive';
export {
	notifyPracticeSupervisorsChanged,
	usePracticeSupervisorsRevision
} from './practiceSupervisionRefresh';
export {
	endPractice,
	enterPracticeMode,
	exitPracticeMode,
	holdPracticeExit,
	isPracticeMode,
	onPracticeExit
} from './practiceMode';
export { PracticeBlockedRequestError } from './networkGuard';
