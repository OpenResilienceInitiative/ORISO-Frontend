import type { TeamDiscussionStatus } from '../../api/apiTeamDiscussion';

/**
 * FE#2491 — the team chat of one open enquiry, as every entry point sees it
 * ("Weitere Funktionen", header indication, the action beside "Annehmen",
 * the panel). Built like supervision: switched on and off per enquiry.
 *
 * - `unavailable`: not offered here (feature off on platform, Träger or
 *   Beratungsstelle; not a counsellor; not an open enquiry; rejected).
 * - `pending`: the lookup has not answered yet — offer nothing.
 * - `off`: no team chat yet; switching on creates it.
 * - `on`: OPEN — writable, shown in the header.
 * - `closed`: switched off — history read-only, switching on reopens it.
 * - `archived`: read-only for good after accept (ADR-016).
 */
export type EnquiryTeamChatState =
	| 'unavailable'
	| 'pending'
	| 'off'
	| 'on'
	| 'closed'
	| 'archived';

export const resolveEnquiryTeamChatState = ({
	eligible,
	resolved,
	hasRoom,
	status
}: {
	eligible: boolean;
	resolved: boolean;
	hasRoom: boolean;
	status?: TeamDiscussionStatus;
}): EnquiryTeamChatState => {
	if (!eligible) return 'unavailable';
	if (!resolved) return 'pending';
	if (!hasRoom || !status) return 'off';
	if (status === 'CLOSED') return 'closed';
	if (status === 'ARCHIVED') return 'archived';
	return 'on';
};
