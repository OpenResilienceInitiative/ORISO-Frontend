import { Modality } from '../session/getModality';

/**
 * Where the composer's @-mention list takes its names from.
 *
 * - `none`: mentions are a counsellor tool; advice seekers and anonymous live
 *   chats have no list by design, not by failure.
 * - `room`: an internal colleague chat belongs to no counselling centre, so
 *   its own members are the list (FE#1211).
 * - `agency`: the counselling centre's consultant list.
 * - `missing`: a conversation that should have a centre but carries none.
 */
export type MentionDirectorySource = 'none' | 'room' | 'agency' | 'missing';

export const mentionDirectorySource = ({
	isAskerOnly,
	modality,
	agencyId
}: {
	isAskerOnly: boolean;
	modality: Modality;
	agencyId: string;
}): MentionDirectorySource => {
	if (isAskerOnly || modality === Modality.LIVE_CHAT) {
		return 'none';
	}
	if (modality === Modality.INTERNAL_GROUP) {
		return 'room';
	}
	return agencyId ? 'agency' : 'missing';
};
