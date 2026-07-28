/**
 * FE#514 / ADR-016 — pure logic for the Team-Besprechung panel, kept free of
 * React/Matrix imports so it stays unit-testable.
 */

export interface TeamDiscussionMessage {
	id: string;
	senderMatrixId: string;
	senderDisplayName: string;
	body: string;
	ts: number;
	isOwn: boolean;
}

/** Minimal structural view of a matrix-js-sdk MatrixEvent used here. */
export interface TimelineEventLike {
	getId: () => string | undefined;
	getType: () => string;
	getSender: () => string | undefined;
	getTs: () => number;
	getContent: () => { msgtype?: string; body?: string };
}

/**
 * Maps a room timeline to flat discussion messages: text messages only,
 * chronological, deduplicated by event id.
 */
export const mapTimelineToDiscussionMessages = (
	events: TimelineEventLike[],
	ownMatrixUserId: string | null | undefined,
	resolveDisplayName?: (matrixUserId: string) => string | undefined
): TeamDiscussionMessage[] => {
	const seen = new Set<string>();
	const messages: TeamDiscussionMessage[] = [];
	for (const event of events) {
		if (event.getType() !== 'm.room.message') {
			continue;
		}
		const content = event.getContent();
		if (content?.msgtype !== 'm.text' || !content.body) {
			continue;
		}
		const id = event.getId();
		if (!id || seen.has(id)) {
			continue;
		}
		seen.add(id);
		const sender = event.getSender() || '';
		messages.push({
			id,
			senderMatrixId: sender,
			senderDisplayName:
				resolveDisplayName?.(sender) || matrixLocalpart(sender),
			body: content.body,
			ts: event.getTs(),
			isOwn: !!ownMatrixUserId && sender === ownMatrixUserId
		});
	}
	return messages.sort((a, b) => a.ts - b.ts);
};

export const matrixLocalpart = (matrixUserId: string): string => {
	const withoutSigil = matrixUserId.startsWith('@')
		? matrixUserId.substring(1)
		: matrixUserId;
	const colon = withoutSigil.indexOf(':');
	return colon > 0 ? withoutSigil.substring(0, colon) : withoutSigil;
};

export interface TeamDiscussionAvailabilityInput {
	isConsultant: boolean;
	isEnquiry: boolean;
	isGroup: boolean;
	isAnonymous: boolean;
	featureEnabled: boolean;
	hasExistingDiscussion: boolean;
}

/**
 * ADR-016 scope: the panel exists for consultants on Agency-Counselling
 * enquiries only (Live Chat is anonymous/ephemeral and excluded; groups have
 * no request area). After acceptance the enquiry flag drops — the panel then
 * only shows when an (archived) discussion already exists (read-only archive
 * access), never to start a new one.
 */
export const isTeamDiscussionAvailable = ({
	isConsultant,
	isEnquiry,
	isGroup,
	isAnonymous,
	featureEnabled,
	hasExistingDiscussion
}: TeamDiscussionAvailabilityInput): boolean => {
	if (!featureEnabled || !isConsultant || isGroup || isAnonymous) {
		return false;
	}
	return isEnquiry || hasExistingDiscussion;
};
