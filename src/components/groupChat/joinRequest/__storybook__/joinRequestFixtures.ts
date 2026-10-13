import type {
	GroupChatJoinRequest,
	GroupChatJoinRequester,
	GroupChatModeratorRole
} from '../joinRequestModel';

/** The clock every knock story runs on: 23.09.2026, 18:05 (Berlin). */
export const KNOCK_STORY_NOW = new Date('2026-09-23T18:05:00+02:00');

const minutesBefore = (minutes: number) =>
	new Date(KNOCK_STORY_NOW.getTime() - minutes * 60_000).toISOString();

export const KNOCK_GROUP_TITLE = 'HIV und Aids';
export const KNOCK_SERIES_ID = 9101;

/** Four colleagues, the realistic mix: own Träger, other Beratungsstelle, other Träger. */
export const knockRequesters: Record<string, GroupChatJoinRequester> = {
	anna: {
		consultantId: 'sb-anna-berg',
		displayName: 'Anna Berg',
		agencyName: 'Suchtberatung Köln-Nord',
		tenantName: 'Caritasverband Köln',
		sameAgency: false,
		sameTenant: true
	},
	jonas: {
		consultantId: 'sb-jonas-keller',
		displayName: 'Jonas Keller',
		agencyName: 'Aidsberatung Köln-Süd',
		tenantName: 'Caritasverband Köln',
		sameAgency: false,
		sameTenant: true
	},
	mira: {
		consultantId: 'sb-mira-sommer',
		displayName: 'Mira Sommer',
		agencyName: 'Beratungsstelle Bonn',
		tenantName: 'Diakonie Bonn',
		sameAgency: false,
		sameTenant: false
	},
	yusuf: {
		consultantId: 'sb-yusuf-demir',
		displayName: 'Yusuf Demir-Hoffmann',
		agencyName: 'Psychosoziale Beratung für Menschen mit HIV Leverkusen',
		tenantName: 'Caritasverband Leverkusen',
		sameAgency: false,
		sameTenant: false
	}
};

export const knockRequest = (
	requester: GroupChatJoinRequester,
	{
		id,
		minutesAgo,
		viewerRole = 'OWNER'
	}: {
		id: number;
		minutesAgo: number;
		viewerRole?: GroupChatModeratorRole;
	}
): GroupChatJoinRequest => ({
	id,
	seriesId: KNOCK_SERIES_ID,
	groupTitle: KNOCK_GROUP_TITLE,
	status: 'PENDING',
	requestedAt: minutesBefore(minutesAgo),
	via: 'INVITE_LINK',
	viewerRole,
	requester
});

/** Four people knocking within ten minutes, oldest first. */
export const fourKnocking = (
	viewerRole: GroupChatModeratorRole = 'OWNER'
): GroupChatJoinRequest[] => [
	knockRequest(knockRequesters.anna, { id: 1, minutesAgo: 9, viewerRole }),
	knockRequest(knockRequesters.jonas, { id: 2, minutesAgo: 6, viewerRole }),
	knockRequest(knockRequesters.mira, { id: 3, minutesAgo: 2, viewerRole }),
	knockRequest(knockRequesters.yusuf, { id: 4, minutesAgo: 0, viewerRole })
];
