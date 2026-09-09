/**
 * Which kinds of call a tenant allows in a given kind of chat.
 *
 * This is the pair of nested ternaries `SessionMenu.tsx` grew for the header
 * call buttons, lifted out so the supervision side room asks the SAME
 * question instead of a second, subtly different one (Frank, 09.09.2026).
 *
 * The settings already carry a `…SupervisionChats…` flag per kind. In
 * `SessionMenu` the supervision branch is reached via `props.isSupervisor`,
 * i.e. by WHO is looking; for a side room it is reached by WHICH room is on
 * screen — the supervision room is a supervision chat for both of its
 * members. Passing the chat type in makes that difference explicit.
 *
 * Every flag defaults to `true` and only an explicit `false` switches a call
 * off — the legacy master `featureCallsEnabled` included.
 */
export type CallChatType = 'anonymous' | 'oneOnOne' | 'group' | 'supervision';

export interface CallFeatureSettings {
	featureCallsEnabled?: boolean;
	featureAudioCallsEnabled?: boolean;
	featureAudioCallsAnonymousChatsEnabled?: boolean;
	featureAudioCallsOneOnOneChatsEnabled?: boolean;
	featureAudioCallsGroupChatsEnabled?: boolean;
	featureAudioCallsSupervisionChatsEnabled?: boolean;
	featureVideoCallsEnabled?: boolean;
	featureVideoCallsAnonymousChatsEnabled?: boolean;
	featureVideoCallsOneOnOneChatsEnabled?: boolean;
	featureVideoCallsGroupChatsEnabled?: boolean;
	featureVideoCallsSupervisionChatsEnabled?: boolean;
}

export interface CallFeatureGates {
	audio: boolean;
	video: boolean;
}

const perChatType = (
	settings: CallFeatureSettings,
	chatType: CallChatType,
	keys: {
		anonymous: keyof CallFeatureSettings;
		oneOnOne: keyof CallFeatureSettings;
		group: keyof CallFeatureSettings;
		supervision: keyof CallFeatureSettings;
	}
) => settings[keys[chatType]] !== false;

export const resolveCallFeatureGates = (
	settings: CallFeatureSettings,
	chatType: CallChatType
): CallFeatureGates => {
	const callsOn = settings.featureCallsEnabled !== false;
	return {
		audio:
			callsOn &&
			settings.featureAudioCallsEnabled !== false &&
			perChatType(settings, chatType, {
				anonymous: 'featureAudioCallsAnonymousChatsEnabled',
				oneOnOne: 'featureAudioCallsOneOnOneChatsEnabled',
				group: 'featureAudioCallsGroupChatsEnabled',
				supervision: 'featureAudioCallsSupervisionChatsEnabled'
			}),
		video:
			callsOn &&
			settings.featureVideoCallsEnabled !== false &&
			perChatType(settings, chatType, {
				anonymous: 'featureVideoCallsAnonymousChatsEnabled',
				oneOnOne: 'featureVideoCallsOneOnOneChatsEnabled',
				group: 'featureVideoCallsGroupChatsEnabled',
				supervision: 'featureVideoCallsSupervisionChatsEnabled'
			})
	};
};
