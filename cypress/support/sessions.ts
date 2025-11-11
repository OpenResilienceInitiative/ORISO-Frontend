import { v4 as uuid } from 'uuid';
import { SESSION_LIST_TYPES } from '../../src/components/session/sessionHelpers';
import {
	ListItemInterface,
	SessionUserDataInterface
} from '../../src/globalState/interfaces';

export const generateConsultantSession = ({
	type,
	messagesRead
}: {
	type?: SESSION_LIST_TYPES;
	messagesRead?: boolean;
} = {}): ListItemInterface => {
	let status;
	if (type === SESSION_LIST_TYPES.ENQUIRY) {
		status = 1;
	} else {
		status = 2;
	}

	const sessionId = Math.random();
	const rcGroupId = uuid();

	const sessionData: SessionUserDataInterface = {
		addictiveDrugs: null,
		age: null,
		gender: null,
		relation: null
	} as SessionUserDataInterface;

	return {
		session: {
			id: sessionId,
			agencyId: 1,
			consultingType: 0,
			topic: {
				id: 1,
				name: 'topic',
				description: 'description'
			},
			status,
			postcode: 12345,
			groupId: rcGroupId,
			askerRcId: 'askerRcId',
			lastMessage: 'lastMessage',
			messageDate: 1606900238,
			messagesRead: messagesRead === undefined ? true : messagesRead,
			attachment: null,
			registrationType: 'REGISTERED',
			e2eLastMessage: {
				t: '1606900238',
				msg: 'lastMessage'
			},
			createDate: '2024-03-28',
			videoCallMessageDTO: {
				eventType: '',
				initiatorRcUserId: '',
				initiatorUserName: ''
			}
		},
		chat: null,
		user: {
			username: 'sucht-asker-3',
			sessionData: sessionData
		},
		consultant: {
			id: 'consultant',
			firstName: 'firstName',
			lastName: 'lastName',
			consultantId: '',
			absent: false,
			absenceMessage: '',
			username: 'consultant'
		},
		latestMessage: '2020-12-02T10:10:38.986+01:00'
	};
};

export const generateMultipleConsultantSessions = (amount: number): void => {
	for (let i = 0; i < amount; i++) {
		cy.consultantSession();
	}
};

export const generateAskerSession = ({
	messagesRead
}: {
	messagesRead?: boolean;
} = {}): ListItemInterface => {
	const sessionId = Math.random();
	const rcGroupId = uuid();

	return {
		session: {
			id: sessionId,
			agencyId: 1,
			consultingType: 1,
			topic: {
				id: 1,
				name: 'topic',
				description: 'description'
			},
			status: 2,
			postcode: 12345,
			groupId: rcGroupId,
			askerRcId: 'askerRcId1',
			lastMessage: null,
			messageDate: null,
			messagesRead: messagesRead === undefined ? true : messagesRead,
			attachment: null,
			registrationType: 'REGISTERED',
			e2eLastMessage: {
				t: '1606900238',
				msg: 'lastMessage'
			},
			createDate: '2024-03-28',
			videoCallMessageDTO: {
				eventType: '',
				initiatorRcUserId: '',
				initiatorUserName: ''
			}
		},
		chat: null,
		agency: {
			id: 1,
			name: 'agency name',
			postcode: '12345',
			city: 'city',
			description: null,
			offline: false,
			consultingType: 1
		},
		consultant: {
			username: 'consultant',
			consultantId: '',
			absent: false,
			absenceMessage: null
		}
	};
};

export const generateMultipleAskerSessions = (amount: number): void => {
	for (let i = 0; i < amount; i++) {
		cy.askerSession();
	}
};

export const sessionsReply = ({
	sessions,
	offset,
	count,
	total
}: {
	sessions: any;
	offset?: number;
	count?: number;
	total?: number;
}) => {
	const _offset = offset || 0;
	const _count = count || 15;
	return {
		sessions: sessions.slice(_offset, _count),
		offset: _offset,
		count: _count,
		total: total || sessions.length
	};
};

export const generateMessage = ({
	rcGroupId,
	unread
}: {
	rcGroupId?: string;
	unread?: boolean;
} = {}): MessageService.Schemas.MessagesDTO => {
	const id = uuid();
	return {
		_id: id,
		alias: null,
		rid: rcGroupId,
		msg: `message id ${id}`,
		ts: new Date().toISOString(),
		u: {
			_id: 'consultant',
			username: 'consultant',
			name: null
		},
		unread: unread === undefined ? true : unread,
		_updatedAt: new Date().toISOString(),
		attachments: [],
		file: null,
		mentions: [],
		channels: []
	};
};

export const generateMultipleMessages = (
	amount: number
): MessageService.Schemas.MessagesDTO[] => {
	const messages: MessageService.Schemas.MessagesDTO[] = [];
	for (let i = 0; i < amount; i++) {
		messages.push(generateMessage());
	}

	return messages;
};

export const generateMessagesReply = (
	messages: MessageService.Schemas.MessagesDTO[]
): MessageService.Schemas.MessageStreamDTO => {
	return {
		messages,
		count: messages.length,
		offset: 0,
		total: messages.length,
		success: true,
		cleaned: null
	};
};
