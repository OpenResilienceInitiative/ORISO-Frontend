import type {
	TopicsDataInterface,
	UserDataInterface
} from '../../globalState/interfaces';
import {
	STATUS_ACTIVE,
	STATUS_ENQUIRY
} from '../../globalState/interfaces/SessionsDataInterface';
import { SYSTEM_NOTIFICATION_PREFIX } from '../../components/message/messageConstants';
import {
	ERSTANTWORT_PAYLOAD_VERSION,
	SYSTEM_NOTIFICATION_FIRST_RESPONSE
} from '../../components/erstantwort/erstantwortPayload';
import {
	PRACTICE_AGENCY_ID,
	PRACTICE_ENQUIRY_SESSION_ID,
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_SUPERVISION_ROOM_ID,
	PRACTICE_TEAM_ROOM_ID,
	PRACTICE_TOPIC_ID,
	practiceUserId
} from '../practiceIds';
import {
	PRACTICE_COUNSELLOR_MATRIX_USER_ID,
	type PracticePerson
} from './practiceCast';
import type { ScriptEngine } from '../script/ScriptEngine';

/** F1 starts with an open enquiry, F2 with an already accepted case. */
export type PracticeStart = 'enquiry' | 'acceptedCase';

export const PRACTICE_SYSTEM_MATRIX_USER_ID = practiceUserId('system');

/** The only topic the practice view knows; real topics never reach it. */
export const createPracticeTopic = (name: string): TopicsDataInterface => ({
	id: PRACTICE_TOPIC_ID,
	name,
	slug: 'uebung',
	description: '',
	internalIdentifier: 'practice',
	status: 'ACTIVE',
	createDate: '',
	updateDate: '',
	fallbackUrl: '',
	titles: {
		short: name,
		long: name,
		registrationDropdown: name,
		welcome: name
	}
});

export interface PracticeMessageSeed {
	sender: string;
	body: string;
	ts: number;
}

export interface PracticeRoomSeed {
	roomId: string;
	name: string;
	members: { userId: string; displayName: string }[];
	messages: PracticeMessageSeed[];
}

export interface PracticeTeamDiscussion {
	matrixRoomId: string;
	status: 'OPEN' | 'ARCHIVED';
}

/** The REST-side truth of the one practice case. */
export interface PracticeCaseState {
	session: UserService.Schemas.SessionDTO;
	user: UserService.Schemas.SessionUserDTO;
	consultant?: UserService.Schemas.SessionConsultantForConsultantDTO;
	latestMessage: number;
	teamDiscussion: PracticeTeamDiscussion | null;
	supervisors: UserService.Schemas.SessionSupervisorResponseDTO[];
}

export interface PracticeScenario {
	start: PracticeStart;
	counsellor: UserDataInterface;
	practiceCase: PracticeCaseState;
	rooms: PracticeRoomSeed[];
}

const erstantwortBody = (greeting: string) =>
	`${SYSTEM_NOTIFICATION_PREFIX}${JSON.stringify({
		type: SYSTEM_NOTIFICATION_FIRST_RESPONSE,
		version: ERSTANTWORT_PAYLOAD_VERSION,
		// No action Baustein: ADD_EMAIL would reach the real profile (apiPutEmail).
		bausteine: [
			{
				id: 'practice-greeting',
				body: greeting
			}
		]
	})}`;

const memberOf = (person: PracticePerson) => ({
	userId: person.matrixUserId,
	displayName: person.displayName
});

export const counsellorDisplayName = (counsellor: UserDataInterface) =>
	counsellor.displayName ||
	[counsellor.firstName, counsellor.lastName].filter(Boolean).join(' ') ||
	counsellor.userName;

export const counsellorAsSessionConsultant = (
	counsellor: UserDataInterface
): UserService.Schemas.SessionConsultantForConsultantDTO => ({
	id: counsellor.userId,
	firstName: counsellor.firstName,
	lastName: counsellor.lastName,
	username: counsellor.userName,
	displayName: counsellorDisplayName(counsellor)
});

/**
 * Fresh fixtures for one practice run. Only the counsellor's own identity and
 * consulting type come from the real user; everything else is invented.
 */
export const createPracticeScenario = ({
	counsellor,
	script,
	start = 'enquiry',
	now = Date.now()
}: {
	counsellor: UserDataInterface;
	/** Every text and cast name of the run, in the language chosen at start. */
	script: ScriptEngine;
	start?: PracticeStart;
	now?: number;
}): PracticeScenario => {
	const accepted = start === 'acceptedCase';
	const { cast, texts } = script;
	const topic = createPracticeTopic(script.names.topic);
	const minute = 60_000;
	const enquiryTs = now - 30 * minute;
	const counsellorMember = {
		userId: PRACTICE_COUNSELLOR_MATRIX_USER_ID,
		displayName: counsellorDisplayName(counsellor)
	};
	const mainMessages: PracticeMessageSeed[] = [
		{
			sender: PRACTICE_SYSTEM_MATRIX_USER_ID,
			body: erstantwortBody(texts.erstantwortGreeting),
			ts: enquiryTs - minute
		},
		{
			sender: cast.asker.matrixUserId,
			body: texts.askerFirstMessage,
			ts: enquiryTs
		},
		...(accepted
			? [
					{
						sender: PRACTICE_COUNSELLOR_MATRIX_USER_ID,
						body: texts.acceptedCaseCounsellorMessage,
						ts: now - 20 * minute
					},
					{
						sender: cast.asker.matrixUserId,
						body: texts.askerReply,
						ts: now - 10 * minute
					}
				]
			: [])
	];

	return {
		start,
		counsellor,
		practiceCase: {
			session: {
				id: PRACTICE_ENQUIRY_SESSION_ID,
				agencyId: PRACTICE_AGENCY_ID,
				consultingType: counsellor.agencies?.[0]?.consultingType ?? 0,
				status: accepted ? STATUS_ACTIVE : STATUS_ENQUIRY,
				conversationType: 'AGENCY_COUNSELLING',
				postcode: '00000',
				language: 'de',
				matrixRoomId: PRACTICE_MAIN_ROOM_ID,
				askerMatrixUserId: cast.asker.matrixUserId,
				consultantMatrixUserId: accepted
					? PRACTICE_COUNSELLOR_MATRIX_USER_ID
					: null,
				messageDate: Math.floor(
					mainMessages[mainMessages.length - 1].ts / 1000
				),
				messagesRead: true,
				isTeamSession: false,
				registrationType: 'REGISTERED',
				createDate: new Date(enquiryTs).toISOString(),
				topic: {
					id: topic.id,
					name: topic.name,
					description: topic.description
				}
			},
			user: {
				id: cast.asker.id,
				username: cast.asker.username,
				displayName: cast.asker.displayName
			},
			consultant: accepted
				? counsellorAsSessionConsultant(counsellor)
				: undefined,
			latestMessage: mainMessages[mainMessages.length - 1].ts,
			teamDiscussion: null,
			supervisors: []
		},
		rooms: [
			{
				roomId: PRACTICE_MAIN_ROOM_ID,
				name: cast.asker.displayName,
				members: [memberOf(cast.asker), counsellorMember],
				messages: mainMessages
			},
			{
				roomId: PRACTICE_TEAM_ROOM_ID,
				name: script.names.teamRoom,
				members: [memberOf(cast.colleague), counsellorMember],
				messages: [
					{
						sender: cast.colleague.matrixUserId,
						body: texts.teamColleagueMessage,
						ts: enquiryTs + 5 * minute
					}
				]
			},
			{
				roomId: PRACTICE_SUPERVISION_ROOM_ID,
				name: script.names.supervisionRoom,
				members: [memberOf(cast.supervisor), counsellorMember],
				messages: []
			}
		]
	};
};
