import type { UserDataInterface } from '../globalState/interfaces';
import {
	createFakeRestBackend,
	type FakeRestBackend
} from './fakeRest/FakeRestBackend';
import {
	createFakeMatrixService,
	type FakeMatrixService
} from './fakeMatrix/FakeMatrixService';
import {
	createPracticeScenario,
	type PracticeStart
} from './fixtures/practiceScenario';
import { PRACTICE_CAST, PRACTICE_SCRIPT } from './fixtures/practiceCast';
import {
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_SUPERVISION_ROOM_ID
} from './fixtures/practiceIdentifiers';

/** One practice run: the fake REST state and the fake Matrix rooms it points at. */
export interface PracticeWorld {
	readonly start: PracticeStart;
	readonly rest: FakeRestBackend;
	readonly matrix: FakeMatrixService;
}

/**
 * Wires the spike's minimal script: reactions follow counsellor actions, never
 * time. S5/S6 replace the inline reactions with the ScriptEngine.
 */
export const createPracticeWorld = ({
	counsellor,
	start = 'enquiry',
	now = Date.now
}: {
	counsellor: UserDataInterface;
	start?: PracticeStart;
	now?: () => number;
}): PracticeWorld => {
	const scenario = createPracticeScenario({ counsellor, start, now: now() });
	// The accepted case (F2) already contains the asker's answer.
	let askerAnswered = start === 'acceptedCase';

	const matrix: FakeMatrixService = createFakeMatrixService({
		rooms: scenario.rooms,
		now,
		onCounsellorMessage: (roomId) => {
			if (
				roomId !== PRACTICE_MAIN_ROOM_ID ||
				askerAnswered ||
				rest.getCase().session.status !== 2
			) {
				return;
			}
			askerAnswered = true;
			// After the counsellor's own event has been announced.
			queueMicrotask(() =>
				matrix.appendMessage(
					PRACTICE_MAIN_ROOM_ID,
					PRACTICE_CAST.asker.matrixUserId,
					PRACTICE_SCRIPT.askerReply
				)
			);
		}
	});

	const rest = createFakeRestBackend({
		counsellor,
		start,
		now,
		hooks: {
			onSupervisorAdded: () =>
				matrix.appendMessage(
					PRACTICE_SUPERVISION_ROOM_ID,
					PRACTICE_CAST.supervisor.matrixUserId,
					PRACTICE_SCRIPT.supervisorReply
				)
		}
	});

	return { start, rest, matrix };
};
