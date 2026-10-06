import type {
	TopicsDataInterface,
	UserDataInterface
} from '../../globalState/interfaces';
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
} from './practiceIdentifiers';
import {
	PRACTICE_CAST,
	PRACTICE_COUNSELLOR_MATRIX_USER_ID,
	PRACTICE_SCRIPT,
	type PracticePerson
} from './practiceCast';

/** F1 starts with an open enquiry, F2 with an already accepted case. */
export type PracticeStart = 'enquiry' | 'acceptedCase';

export const PRACTICE_SYSTEM_MATRIX_USER_ID = practiceUserId('system');

/** The only topic the practice view knows; real topics never reach it. */
export const PRACTICE_TOPIC: TopicsDataInterface = {
	id: PRACTICE_TOPIC_ID,
	name: 'Übung',
	slug: 'uebung',
	description: '',
	internalIdentifier: 'practice',
	status: 'ACTIVE',
	createDate: '',
	updateDate: '',
	fallbackUrl: '',
	titles: {
		short: 'Übung',
		long: 'Übung',
		registrationDropdown: 'Übung',
		welcome: 'Übung'
	}
};

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

const erstantwortBody = () =>
	`${SYSTEM_NOTIFICATION_PREFIX}${JSON.stringify({
		type: SYSTEM_NOTIFICATION_FIRST_RESPONSE,
		version: ERSTANTWORT_PAYLOAD_VERSION,
		// No action Baustein: ADD_EMAIL would reach the real profile (apiPutEmail).
		bausteine: [
			{
				id: 'practice-greeting',
				body: PRACTICE_SCRIPT.erstantwortGreeting
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
	start = 'enquiry',
	now = Date.now()
}: {
	counsellor: UserDataInterface;
	start?: PracticeStart;
	now?: number;
}): PracticeScenario => {
	const accepted = start === 'acceptedCase';
	const minute = 60_000;
	const enquiryTs = now - 30 * minute;
	const counsellorMember = {
		userId: PRACTICE_COUNSELLOR_MATRIX_USER_ID,
		displayName: counsellorDisplayName(counsellor)
	};
	const mainMessages: PracticeMessageSeed[] = [
		{
			sender: PRACTICE_SYSTEM_MATRIX_USER_ID,
			body: erstantwortBody(),
			ts: enquiryTs - minute
		},
		{
			sender: PRACTICE_CAST.asker.matrixUserId,
			body: PRACTICE_SCRIPT.enquiry,
			ts: enquiryTs
		},
		...(accepted
			? [
					{
						sender: PRACTICE_COUNSELLOR_MATRIX_USER_ID,
						body: PRACTICE_SCRIPT.acceptedCaseCounsellor,
						ts: now - 20 * minute
					},
					{
						sender: PRACTICE_CAST.asker.matrixUserId,
						body: PRACTICE_SCRIPT.askerReply,
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
				status: accepted ? 2 : 1,
				conversationType: 'AGENCY_COUNSELLING',
				postcode: '00000',
				language: 'de',
				matrixRoomId: PRACTICE_MAIN_ROOM_ID,
				askerMatrixUserId: PRACTICE_CAST.asker.matrixUserId,
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
					id: PRACTICE_TOPIC.id,
					name: PRACTICE_TOPIC.name,
					description: PRACTICE_TOPIC.description
				}
			},
			user: {
				id: PRACTICE_CAST.asker.id,
				username: PRACTICE_CAST.asker.username,
				displayName: PRACTICE_CAST.asker.displayName
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
				name: PRACTICE_CAST.asker.displayName,
				members: [memberOf(PRACTICE_CAST.asker), counsellorMember],
				messages: mainMessages
			},
			{
				roomId: PRACTICE_TEAM_ROOM_ID,
				name: 'Team-Besprechung (Übung)',
				members: [memberOf(PRACTICE_CAST.colleague), counsellorMember],
				messages: [
					{
						sender: PRACTICE_CAST.colleague.matrixUserId,
						body: PRACTICE_SCRIPT.teamColleague,
						ts: enquiryTs + 5 * minute
					}
				]
			},
			{
				roomId: PRACTICE_SUPERVISION_ROOM_ID,
				name: 'Supervision (Übung)',
				members: [memberOf(PRACTICE_CAST.supervisor), counsellorMember],
				messages: []
			}
		]
	};
};
