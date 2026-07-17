import type { ComponentProps } from 'react';
import { AUTHORITIES, type ExtendedSessionInterface } from '../../globalState';
import {
	REGISTRATION_TYPE_REGISTERED,
	STATUS_ACTIVE,
	type UserDataInterface
} from '../../globalState/interfaces';
import {
	CHAT_TYPE_GROUP_CHAT,
	CHAT_TYPE_SINGLE_CHAT
} from '../session/sessionHelpers';
import { buildVisibleToPrefix } from './messageConstants';
import { MessageItemComponent, type MessageItem } from './MessageItemComponent';

export const MOCK_ASKER_RC_ID = '@sanftes.alpaka:oriso.invalid';
export const MOCK_CONSULTANT_RC_ID = '@karina.p:oriso.invalid';
export const MOCK_GROUP_MODERATOR_RC_ID = '@angela.k:oriso.invalid';

const MOCK_MATRIX_ROOM_1ON1 = '!storybook-1on1:oriso.org';
const MOCK_MATRIX_ROOM_GROUP = '!storybook-internal-group:oriso.org';

export function mockActiveSession(
	overrides: Partial<ExtendedSessionInterface> = {}
): ExtendedSessionInterface {
	return {
		rid: MOCK_MATRIX_ROOM_1ON1,
		type: CHAT_TYPE_SINGLE_CHAT,
		isGroup: false,
		isSession: true,
		item: {
			id: 3363,
			agencyId: 101,
			askerRcId: MOCK_ASKER_RC_ID,
			groupId: MOCK_MATRIX_ROOM_1ON1,
			matrixRoomId: MOCK_MATRIX_ROOM_1ON1,
			postcode: 10115,
			registrationType: REGISTRATION_TYPE_REGISTERED,
			status: STATUS_ACTIVE,
			topic: {
				id: 2,
				name: 'Suchtprobleme',
				description: 'Beratung zu Sucht, Rückfall und Stabilisierung.'
			},
			moderators: [],
			messageDate: Date.now(),
			messagesRead: true
		},
		user: {
			username: 'sanftes.alpaka.kala@oriso.invalid',
			displayName: 'Sanftes Alpaka Kala',
			sessionData: {}
		},
		consultant: {
			consultantId: 'consultant-storybook',
			id: 'consultant-storybook',
			username: 'karina.p@oriso.invalid',
			displayName: 'Karina P',
			firstName: 'Karina',
			lastName: 'P',
			absent: false,
			absenceMessage: ''
		},
		...overrides
	};
}

export function mockActiveSession1on1(
	overrides: Partial<ExtendedSessionInterface> = {}
): ExtendedSessionInterface {
	return mockActiveSession({
		rid: MOCK_MATRIX_ROOM_1ON1,
		type: CHAT_TYPE_SINGLE_CHAT,
		isGroup: false,
		isSession: true,
		...overrides
	});
}

export function mockActiveSessionGroup(
	overrides: Partial<ExtendedSessionInterface> = {}
): ExtendedSessionInterface {
	return mockActiveSession({
		rid: MOCK_MATRIX_ROOM_GROUP,
		type: CHAT_TYPE_GROUP_CHAT,
		isGroup: true,
		isSession: false,
		item: {
			id: 4401,
			agencyId: 101,
			askerRcId: MOCK_ASKER_RC_ID,
			groupId: MOCK_MATRIX_ROOM_GROUP,
			matrixRoomId: MOCK_MATRIX_ROOM_GROUP,
			postcode: 10115,
			registrationType: REGISTRATION_TYPE_REGISTERED,
			status: STATUS_ACTIVE,
			topic: 'Interner Gruppenchat',
			moderators: [MOCK_CONSULTANT_RC_ID, MOCK_GROUP_MODERATOR_RC_ID],
			messageDate: Date.now(),
			messagesRead: true,
			active: true,
			assignedAgencies: [],
			attachment: {} as any,
			consultingType: 1,
			duration: 60,
			hintMessage: '',
			lastMessage: '',
			e2eLastMessage: { t: '', msg: '' },
			repetitive: false,
			startDate: '2026-07-10',
			startTime: '10:00',
			subscribed: true,
			createdAt: '2026-07-01T00:00:00.000Z'
		},
		...overrides
	});
}

export function mockUserData(
	overrides: Partial<UserDataInterface> = {}
): UserDataInterface {
	return {
		userId: 'consultant-storybook',
		userName: 'karina.p@oriso.invalid',
		displayName: 'Karina P',
		firstName: 'Karina',
		lastName: 'P',
		grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
		agencies: [],
		emailToggles: [],
		e2eEncryptionEnabled: false,
		formalLanguage: false,
		hasArchive: true,
		isDisplayNameEditable: true,
		preferredLanguage: 'de',
		userRoles: [],
		termsAndConditionsConfirmation: '',
		dataPrivacyConfirmation: '',
		twoFactorAuth: {
			isEnabled: false,
			isActive: false,
			isShown: false,
			secret: '',
			qrCode: ''
		},
		...overrides
	};
}

export function mockE2EEContext() {
	return {
		key: null,
		reloadPrivateKey: () => {},
		isE2eeEnabled: false,
		e2EEReady: true
	};
}

export function mockServerSettingsContext() {
	return {
		settings: [],
		settingsReady: true,
		getSetting: () => ({ value: false }) as any
	};
}

export function mockConsultantListContext() {
	return {
		consultantList: [],
		setConsultantList: () => {},
		reloadConsultantList: () => {}
	};
}

export function mockE2eeParams() {
	return {
		keyID: '',
		key: null,
		encrypted: false,
		subscriptionKeyLost: false
	};
}

export function mockMessageItem(
	overrides: Partial<MessageItem> = {}
): MessageItem {
	return {
		_id: 'msg-storybook-1',
		message:
			'Ich habe heute wieder starkes Verlangen und brauche kurz Orientierung.',
		messageDate: { str: 'Heute', date: null },
		messageTime: String(new Date('2026-07-10T09:18:00').getTime()),
		displayName: 'Sanftes Alpaka Kala',
		username: 'sanftes.alpaka.kala@oriso.invalid',
		askerRcId: MOCK_ASKER_RC_ID,
		userId: MOCK_ASKER_RC_ID,
		isNotRead: false,
		t: null,
		rid: MOCK_MATRIX_ROOM_1ON1,
		...overrides
	};
}

export type MessageItemStoryProps = ComponentProps<typeof MessageItemComponent>;

export function mockMessageItemComponentProps(
	overrides: Partial<MessageItemStoryProps> = {}
): MessageItemStoryProps {
	return {
		...mockMessageItem(),
		clientName: 'Sanftes Alpaka Kala',
		isMyMessage: false,
		isUserBanned: false,
		isOnlyEnquiry: false,
		handleDecryptionErrors: () => {},
		handleDecryptionSuccess: () => {},
		e2eeParams: mockE2eeParams(),
		...overrides
	};
}

export const mockAppointmentAliasContent = JSON.stringify({
	title: 'Erstgespräch Suchtberatung',
	user: 'sanftes.alpaka.kala',
	counselor: 'karina.p',
	date: new Date('2026-07-15T10:00:00.000Z').toISOString(),
	duration: 45,
	location: 'Online',
	note: 'Bitte halten Sie die Unterlagen aus dem letzten Gespräch bereit.'
});

export const mockLongGermanMessage =
	'Heute war es besonders schwer für mich, und ich brauche kurz Orientierung. '.repeat(
		12
	);

export const mockVisibilityMessage = `${buildVisibleToPrefix([
	'Sanftes Alpaka Kala',
	'Familienberatung'
])} Diese Nachricht ist nur für ausgewählte Empfänger sichtbar.`;

export const mockSystemNotificationMessage = `[SYSTEM_NOTIFICATION]${JSON.stringify(
	{
		title: 'Systemhinweis',
		description: 'Ihr Beratungstermin wurde aktualisiert.',
		type: 'INFO'
	}
)}`;

export const mockCaseHandoverGrantedMessage = `[SYSTEM_NOTIFICATION]${JSON.stringify(
	{
		type: 'CASE_HANDOVER_GRANTED',
		username: 'Kim G.',
		description:
			'Deine bisherige Berater:in ist leider erkrankt. Damit du nicht warten musst, hat Kim G. deinen Fall übernommen.',
		reasonLabel: 'Counsellor is ill',
		explanation:
			'My colleague is ill, so I decided it is better if I take care of this client.'
	}
)}`;
