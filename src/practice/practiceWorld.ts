import type { UserDataInterface } from '../globalState/interfaces';
import { STATUS_ACTIVE } from '../globalState/interfaces/SessionsDataInterface';
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
import type { ScriptEngine, ScriptReaction } from './script/ScriptEngine';
import { emitPracticeEvent, PRACTICE_TOUR_EVENTS } from './practiceTourEvents';
import { SYSTEM_NOTIFICATION_PREFIX } from '../components/message/messageConstants';
import { PRACTICE_MAIN_ROOM_ID, PRACTICE_TEAM_ROOM_ID } from './practiceIds';

/** One practice run: the fake REST state and the fake Matrix rooms it points at. */
export interface PracticeWorld {
	readonly start: PracticeStart;
	readonly script: ScriptEngine;
	readonly rest: FakeRestBackend;
	readonly matrix: FakeMatrixService;
}

/**
 * Wires one practice run. Reactions follow counsellor actions, never time, and
 * come from the ScriptEngine, which was built once in the run's language. The
 * tour events (`practice:*`) are emitted here, once per counsellor action and
 * never for the scripted messages.
 */
export const createPracticeWorld = ({
	counsellor,
	script,
	start = 'enquiry',
	now = Date.now
}: {
	counsellor: UserDataInterface;
	script: ScriptEngine;
	start?: PracticeStart;
	now?: () => number;
}): PracticeWorld => {
	const scenario = createPracticeScenario({
		counsellor,
		script,
		start,
		now: now()
	});
	// The accepted case (F2) already contains the asker's answer.
	let askerAnswered = start === 'acceptedCase';
	let supervisorAnswered = false;

	const play = (reaction: ScriptReaction | null) => {
		if (reaction) {
			matrix.appendMessage(
				reaction.roomId,
				reaction.sender,
				reaction.body
			);
		}
	};

	const matrix: FakeMatrixService = createFakeMatrixService({
		rooms: scenario.rooms,
		now,
		onCounsellorMessage: (roomId, body, { isEdit }) => {
			if (
				isEdit ||
				// e.g. the "supervision added" note the header posts
				body.startsWith(SYSTEM_NOTIFICATION_PREFIX)
			) {
				return;
			}
			if (roomId === PRACTICE_TEAM_ROOM_ID) {
				emitPracticeEvent(PRACTICE_TOUR_EVENTS.teamMessageSent);
				return;
			}
			if (
				roomId !== PRACTICE_MAIN_ROOM_ID ||
				rest.getCase().session.status !== STATUS_ACTIVE
			) {
				return;
			}
			emitPracticeEvent(PRACTICE_TOUR_EVENTS.messageSent);
			if (askerAnswered) return;
			askerAnswered = true;
			const reaction = script.reactionFor({
				type: 'counsellor-first-reply',
				roomId
			});
			// After the counsellor's own event has been announced.
			queueMicrotask(() => play(reaction));
		}
	});

	const rest = createFakeRestBackend({
		counsellor,
		script,
		start,
		now,
		hooks: {
			onEnquiryAccepted: () =>
				emitPracticeEvent(PRACTICE_TOUR_EVENTS.enquiryAccepted),
			onSupervisorAdded: () => {
				if (!supervisorAnswered) {
					supervisorAnswered = true;
					play(script.reactionFor({ type: 'supervisor-added' }));
				}
				emitPracticeEvent(PRACTICE_TOUR_EVENTS.supervisorAdded);
			}
		}
	});

	return { start, script, rest, matrix };
};
