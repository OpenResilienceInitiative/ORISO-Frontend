import type { AgencyFormatSource } from '../formatAvailability';
import { DIRECT_LINK_MEDIA, DirectLinkMedium } from './directLink';

/**
 * "Direkteinladung erlauben" (TenantService#332, AgencyService#347): which
 * media a counsellor may hand out direct links for. The Träger's effective
 * value comes first; unset means allowed, as TenantService defaults it. A
 * Beratungsstelle can only restrict: its value is already effective (Träger
 * AND agency), and `null` adds no restriction. The backend checks again on
 * every create and every conversation start; this only hides the card.
 */
type DirectInviteFlag =
	| 'featureDirectInviteChatEnabled'
	| 'featureDirectInviteAudioEnabled'
	| 'featureDirectInviteVideoEnabled';

const FLAG: Record<DirectLinkMedium, DirectInviteFlag> = {
	CHAT: 'featureDirectInviteChatEnabled',
	AUDIO: 'featureDirectInviteAudioEnabled',
	VIDEO: 'featureDirectInviteVideoEnabled'
};

type Settings = Partial<Record<DirectInviteFlag, boolean | null>>;

export const getDirectLinkMedia = (
	tenant: { settings?: Settings | null } | null | undefined,
	agencies: AgencyFormatSource[] = []
): DirectLinkMedium[] =>
	DIRECT_LINK_MEDIA.filter((medium) => {
		if (tenant?.settings?.[FLAG[medium]] === false) return false;
		// Without any known agency the Träger's answer stands.
		if (agencies.length === 0) return true;
		return agencies.some(
			(agency) =>
				(agency.settings as Settings | null | undefined)?.[
					FLAG[medium]
				] !== false
		);
	});

/**
 * The Beratungsstelle a link is made for: the one that offers the chosen
 * topic. The backend needs it only when the counsellor works for more than
 * one, and then the topic is what tells them apart.
 */
export const agencyForTopic = (
	agencies: { id: number; topicIds?: number[] | null }[],
	topicId: number
): number | undefined => {
	if (agencies.length <= 1) return undefined;
	return (
		agencies.find((agency) => agency.topicIds?.includes(topicId))?.id ??
		agencies[0]?.id
	);
};
