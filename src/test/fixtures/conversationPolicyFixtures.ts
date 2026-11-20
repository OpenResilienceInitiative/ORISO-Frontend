import {
	CONVERSATION_FEATURE_KEYS,
	type ConversationFeatureSettings,
	type AgencyFeaturePolicy,
	type AgencyFeaturePolicies
} from '../../globalState/interfaces/ConversationFeatureSettings';
import type {
	AgencySettingsInterface,
	AgencyDataInterface,
	ListItemInterface
} from '../../globalState/interfaces';

export const canonicalAgencySettings = (
	overrides: ConversationFeatureSettings = {},
	mode: AgencyFeaturePolicy['mode'] = 'SUGGESTED'
): AgencySettingsInterface => {
	const permissionPolicies: AgencyFeaturePolicies = {};
	for (const key of CONVERSATION_FEATURE_KEYS) {
		permissionPolicies[key] = {
			value: overrides[key] ?? true,
			mode,
			inherited: mode === 'ENFORCED'
		};
	}
	return { permissionPolicies };
};
export const conversationAgency = (
	id = 101,
	settings = canonicalAgencySettings()
): AgencyDataInterface => ({
	id,
	name: `Agency ${id}`,
	city: '',
	consultingType: 1,
	description: '',
	offline: false,
	postcode: '',
	settings
});

export const conversationSessionListItem = (
	roomId: string,
	agencyId = 101
): ListItemInterface => ({
	agency: conversationAgency(agencyId),
	user: { username: 'client', sessionData: {} },
	session: {
		id: 41,
		agencyId,
		matrixRoomId: roomId,
		askerMatrixUserId: '@asker:matrix.example',
		attachment: {},
		consultingType: 1,
		e2eLastMessage: { t: '', msg: '' },
		messageDate: 1,
		createDate: '2026-10-28T00:00:00Z',
		messagesRead: true,
		postcode: 10115,
		registrationType: 'REGISTERED',
		status: 2,
		videoCallMessageDTO: {
			eventType: 'IGNORED_CALL',
			initiatorMatrixUserId: '',
			initiatorUserName: ''
		},
		topic: { id: 1, name: 'Test', description: '' }
	}
});
