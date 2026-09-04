/**
 * Fixtures for the chat-stage stories. German content, three fixed people:
 * the client `Sonnenblume_47` (anonymous pseudonym), the counsellor
 * `Mona S.` (viewer) and the supervisor `Bettina B.`. The client name must
 * never show up inside the supervision side room.
 */
import {
	AUTHORITIES,
	buildExtendedSession,
	type ExtendedSessionInterface
} from '../../../globalState';
import type {
	ConsultingTypeInterface,
	ListItemInterface,
	TopicsDataInterface,
	UserDataInterface
} from '../../../globalState/interfaces';
import {
	REGISTRATION_TYPE_REGISTERED,
	STATUS_ACTIVE
} from '../../../globalState/interfaces';
import type { MessageItem } from '../../message/MessageItemComponent';

export const CLIENT_NAME = 'Sonnenblume_47';
export const COUNSELLOR_NAME = 'Mona S.';
export const SUPERVISOR_NAME = 'Bettina B.';

export const CLIENT_MATRIX_ID = '@sonnenblume_47:oriso.invalid';
export const COUNSELLOR_MATRIX_ID = '@mona.s:oriso.invalid';
export const SUPERVISOR_MATRIX_ID = '@bettina.b:oriso.invalid';

export const COUNSELLOR_ID = 'consultant-storybook';
export const SUPERVISOR_ID = 'consultant-bettina';

export const CLIENT_ROOM_ID = '!sonnenblume-4711:oriso.invalid';
export const SUPERVISION_ROOM_ID = '!supervision-4711:oriso.invalid';
export const SESSION_ID = 4711;

/** The counsellor is the viewer in every stage story. */
export const isCounsellorMessage = (userId: string) =>
	userId === COUNSELLOR_MATRIX_ID;

const at = (hhmm: string) =>
	String(new Date(`2026-09-04T${hhmm}:00+02:00`).getTime());

const message = (
	id: string,
	author: 'client' | 'counsellor' | 'supervisor',
	body: string,
	time: string,
	rid: string,
	overrides: Partial<MessageItem> = {}
): MessageItem => {
	const people = {
		client: {
			displayName: CLIENT_NAME,
			username: 'sonnenblume_47',
			userId: CLIENT_MATRIX_ID
		},
		counsellor: {
			displayName: COUNSELLOR_NAME,
			username: 'mona.s@oriso.invalid',
			userId: COUNSELLOR_MATRIX_ID
		},
		supervisor: {
			displayName: SUPERVISOR_NAME,
			username: 'bettina.b@oriso.invalid',
			userId: SUPERVISOR_MATRIX_ID
		}
	}[author];
	return {
		_id: id,
		message: body,
		messageDate: { str: 'Heute', date: null } as MessageItem['messageDate'],
		messageTime: at(time),
		askerMatrixUserId: CLIENT_MATRIX_ID,
		isNotRead: false,
		t: null,
		rid,
		...people,
		...overrides
	};
};

/** The client chat — the only timeline where the client name appears. */
export const mainChatMessages = (): MessageItem[] => [
	message(
		'$m1',
		'client',
		'Hallo, ich weiß nicht so recht, wo ich anfangen soll. Es ist gerade alles ein bisschen viel.',
		'08:58',
		CLIENT_ROOM_ID
	),
	message(
		'$m2',
		'counsellor',
		'Schön, dass Sie sich gemeldet haben. Fangen Sie einfach dort an, wo es Ihnen gerade am meisten auf der Seele liegt.',
		'09:02',
		CLIENT_ROOM_ID
	),
	message(
		'$m3',
		'client',
		'Es sind ein paar Briefe gekommen, die ich nicht aufgemacht habe. Mahnbescheide, glaube ich. Aber eigentlich geht es mir eher um meinen Job.',
		'09:07',
		CLIENT_ROOM_ID
	),
	message(
		'$m4',
		'counsellor',
		'Beides darf hier Platz haben. Wenn Sie mögen, erzählen Sie mir zuerst, was bei der Arbeit gerade passiert.',
		'09:09',
		CLIENT_ROOM_ID
	),
	message(
		'$m5',
		'client',
		'Mein Vertrag läuft im Oktober aus und niemand sagt mir, ob er verlängert wird. Ich schlafe kaum noch.',
		'09:14',
		CLIENT_ROOM_ID
	),
	message(
		'$m6',
		'counsellor',
		'Das klingt nach einer sehr belastenden Ungewissheit. Lassen Sie uns gemeinsam sortieren, was Sie jetzt beeinflussen können und was nicht.',
		'09:18',
		CLIENT_ROOM_ID
	)
];

/** The supervision side room: counsellor ↔ supervisor, never the client. */
export const supervisionMessages = (): MessageItem[] => [
	message(
		'$s1',
		'counsellor',
		'Die Ratsuchende hat heute zum zweiten Mal Mahnbescheide erwähnt, geht aber jedes Mal sofort auf ein anderes Thema. Wie würdest du das ansprechen?',
		'09:12',
		SUPERVISION_ROOM_ID
	),
	message(
		'$s2',
		'supervisor',
		'Ich würde es nicht forcieren. Benenne kurz, dass du das Thema wahrgenommen hast, und lass die Entscheidung bei ihr – Vermeidung ist hier oft Scham.',
		'09:15',
		SUPERVISION_ROOM_ID
	),
	message(
		'$s3',
		'supervisor',
		'Wenn es beim dritten Mal wieder kommt: Angebot für einen konkreten Termin zur Schuldenaufstellung machen, ohne Zahlen im Chat.',
		'09:16',
		SUPERVISION_ROOM_ID
	),
	message(
		'$s4',
		'counsellor',
		'Danke, das hilft. Ich formuliere es so und melde mich nach dem nächsten Kontakt.',
		'09:20',
		SUPERVISION_ROOM_ID
	)
];

/** A thread on the client's message `$m3`: root first, then replies. */
export const THREAD_ROOT_ID = '$m3';
export const threadMessages = (): MessageItem[] => [
	message(
		'$t1',
		'counsellor',
		'Zu den Briefen: Es ist völlig in Ordnung, sie erst einmal liegen zu lassen. Wenn Sie so weit sind, schauen wir sie gemeinsam an.',
		'09:21',
		CLIENT_ROOM_ID,
		{ threadRootEventId: THREAD_ROOT_ID }
	),
	message(
		'$t2',
		'client',
		'Okay. Vielleicht nächste Woche, wenn ich weiß, wie es mit dem Vertrag weitergeht.',
		'09:25',
		CLIENT_ROOM_ID,
		{ threadRootEventId: THREAD_ROOT_ID }
	)
];

export const stageTopic: TopicsDataInterface = {
	id: 5,
	name: 'Schuldnerberatung',
	slug: 'debt',
	description:
		'Hilfe bei Schulden, Mahnungen und finanzieller Überforderung.',
	internalIdentifier: 'debt',
	status: 'active',
	createDate: '2026-03-01T00:00:00.000Z',
	updateDate: '2026-03-01T00:00:00.000Z',
	fallbackUrl: '',
	titles: {
		short: 'Schulden',
		long: 'Schuldnerberatung',
		registrationDropdown: 'Schuldnerberatung',
		welcome: 'Schuldnerberatung'
	}
};

export const stageConsultingType: ConsultingTypeInterface = {
	id: 1,
	showAskerProfile: true,
	titles: {
		default: '1-1 Beratung',
		short: '1-1',
		long: '1-1 Beratung',
		welcome: 'Willkommen',
		registrationDropdown: '1-1 Beratung'
	},
	isVideoCallAllowed: true,
	isSubsequentRegistrationAllowed: true,
	urls: {
		registrationPostcodeFallbackUrl: '',
		requiredAidMissingRedirectUrl: ''
	},
	registration: {
		autoSelectAgency: false,
		autoSelectPostcode: false,
		notes: {}
	},
	groupChat: {
		isGroupChat: false,
		groupChatRules: ['']
	},
	description: 'Chat-stage fixture.',
	slug: 'one-on-one',
	languageFormal: true,
	welcomeScreen: {
		anonymous: {
			title: 'Willkommen',
			text: ''
		}
	}
};

export const counsellorUserData: UserDataInterface = {
	userId: COUNSELLOR_ID,
	userName: 'mona.s@oriso.invalid',
	displayName: COUNSELLOR_NAME,
	firstName: 'Mona',
	lastName: 'S.',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	agencies: [],
	emailToggles: [],
	e2eEncryptionEnabled: false,
	formalLanguage: true,
	hasArchive: true,
	isDisplayNameEditable: true,
	preferredLanguage: 'de',
	userRoles: ['CONSULTANT'],
	termsAndConditionsConfirmation: '',
	dataPrivacyConfirmation: '',
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		secret: '',
		qrCode: ''
	}
} as unknown as UserDataInterface;

const consultant = {
	consultantId: COUNSELLOR_ID,
	id: COUNSELLOR_ID,
	username: 'mona.s@oriso.invalid',
	displayName: COUNSELLOR_NAME,
	absent: false,
	absenceMessage: ''
};

const listItem = (
	id: number,
	displayName: string,
	username: string,
	matrixRoomId: string,
	postcode: number,
	lastMessage: string,
	messageDate: number,
	extra: Record<string, unknown> = {}
): ListItemInterface =>
	({
		user: { username, displayName, sessionData: {} },
		consultant,
		language: 'de',
		session: {
			id,
			agencyId: 101,
			askerMatrixUserId: `@${username}:oriso.invalid`,
			attachment: null,
			consultingType: 1,
			matrixRoomId,
			e2eLastMessage: null,
			lastMessage,
			messageDate,
			createDate: '2026-08-20T06:15:00.000Z',
			messagesRead: true,
			postcode,
			registrationType: REGISTRATION_TYPE_REGISTERED,
			status: STATUS_ACTIVE,
			videoCallMessageDTO: null,
			topic: stageTopic,
			...extra
		}
	}) as unknown as ListItemInterface;

/** The open conversation (row 2 of the list). */
export const stageListItem = (): ListItemInterface =>
	listItem(
		SESSION_ID,
		CLIENT_NAME,
		'sonnenblume_47',
		CLIENT_ROOM_ID,
		55116,
		'Mein Vertrag läuft im Oktober aus und niemand sagt mir, ob er verlängert wird.',
		1788850680,
		{
			supervision: {
				supervisedByMe: false,
				supervisorConsultantId: SUPERVISOR_ID,
				supervisorDisplayName: SUPERVISOR_NAME,
				counsellorDisplayName: COUNSELLOR_NAME,
				matrixRoomId: SUPERVISION_ROOM_ID
			}
		}
	);

export const stageSession = (): ExtendedSessionInterface =>
	buildExtendedSession(stageListItem(), '');

/** Three rows for the list column; the middle one is the open conversation. */
export const stageListItems = (): ListItemInterface[] => [
	listItem(
		4708,
		'Ruhiges Yak Kim',
		'ruhiges_yak_kim',
		'!yak-4708:oriso.invalid',
		55118,
		'Danke, bis nächste Woche dann.',
		1788847080
	),
	stageListItem(),
	listItem(
		4702,
		'Stiller Fuchs Ali',
		'stiller_fuchs_ali',
		'!fuchs-4702:oriso.invalid',
		55122,
		'Ich habe die Unterlagen jetzt zusammen.',
		1788764280
	)
];

/** Route that marks the open conversation as active in the list. */
export const stageRoute = `/sessions/consultant/sessionView/${CLIENT_ROOM_ID}/${SESSION_ID}`;
