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
import { SYSTEM_NOTIFICATION_SUPERVISOR_REPLACED } from '../components/message/supervisorReplacedNotice';
import {
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_SUPERVISION_ROOM_ID,
	PRACTICE_TEAM_ROOM_ID
} from './practiceIds';

/**
 * The side-room notice the server posts after a supervisor swap (#2494 *6,
 * `SessionSupervisorFacade.buildReplacedNoticeBody`): names and the reason,
 * with the server's German fallback. The app words it in the reader's
 * language (`supervisorReplacedNotice.ts`). Built locally; nothing is sent.
 */
const supervisorReplacedNoticeBody = (
	previousName: string,
	newName: string,
	reason?: string | null
) =>
	`${SYSTEM_NOTIFICATION_PREFIX}${JSON.stringify({
		type: SYSTEM_NOTIFICATION_SUPERVISOR_REPLACED,
		previousName,
		newName,
		...(reason?.trim() ? { reason: reason.trim() } : {}),
		title: 'Supervision gewechselt',
		description: `${newName} supervidiert diesen Chat jetzt anstelle von ${previousName}.`
	})}`;

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
	/** The Supervision tour: Robin answers the counsellor's first message. */
	let supervisionAnswered = false;

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
			if (roomId === PRACTICE_SUPERVISION_ROOM_ID) {
				emitPracticeEvent(PRACTICE_TOUR_EVENTS.supervisionMessageSent);
				if (supervisionAnswered || supervisorAnswered) return;
				supervisionAnswered = true;
				const reaction = script.reactionFor({
					type: 'counsellor-supervision-message'
				});
				// The reply comes from whoever supervises the case now.
				const supervisor = rest
					.getCase()
					.supervisors.find((s) => s.supervisorMatrixUserId);
				queueMicrotask(() =>
					play(
						reaction && supervisor?.supervisorMatrixUserId
							? {
									...reaction,
									sender: supervisor.supervisorMatrixUserId
								}
							: reaction
					)
				);
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
			},
			onCircleCreated: () =>
				emitPracticeEvent(PRACTICE_TOUR_EVENTS.circleCreated),
			onCircleStarted: () =>
				emitPracticeEvent(PRACTICE_TOUR_EVENTS.circleStarted),
			onAppointmentCreated: () =>
				emitPracticeEvent(
					PRACTICE_TOUR_EVENTS.calendarAppointmentCreated
				),
			onInvitationCreated: () =>
				emitPracticeEvent(
					PRACTICE_TOUR_EVENTS.calendarInvitationCreated
				),
			onAppointmentCancelled: () =>
				emitPracticeEvent(
					PRACTICE_TOUR_EVENTS.calendarAppointmentCancelled
				),
			onBlockerCreated: () =>
				emitPracticeEvent(PRACTICE_TOUR_EVENTS.calendarBlockerCreated),
			onAutoAcceptOn: () =>
				emitPracticeEvent(PRACTICE_TOUR_EVENTS.calendarAutoAcceptOn),
			onSupervisorReplaced: (from, to) => {
				const supervisors = [
					script.cast.supervisor,
					script.cast.secondSupervisor
				];
				const previous = supervisors.find(
					({ id }) => id === from.supervisorConsultantId
				);
				const person = supervisors.find(
					({ id }) => id === to.supervisorConsultantId
				);
				if (from.supervisorMatrixUserId && person) {
					matrix.replaceMember(
						PRACTICE_SUPERVISION_ROOM_ID,
						from.supervisorMatrixUserId,
						{
							userId: person.matrixUserId,
							displayName: person.displayName
						}
					);
				}
				if (previous && person) {
					matrix.postServerNotice(
						PRACTICE_SUPERVISION_ROOM_ID,
						supervisorReplacedNoticeBody(
							previous.displayName,
							person.displayName,
							to.notes
						)
					);
				}
				emitPracticeEvent(PRACTICE_TOUR_EVENTS.supervisorReplaced);
			},
			onSupervisorAppointmentBooked: () =>
				emitPracticeEvent(
					PRACTICE_TOUR_EVENTS.supervisorAppointmentBooked
				)
		}
	});

	return { start, script, rest, matrix };
};
