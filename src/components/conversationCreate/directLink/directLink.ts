/**
 * #1795: a counsellor's direct link. One link per medium; it stays valid
 * until switched off, and every person who opens it gets their own
 * one-to-one conversation. Storybook design only, no API yet.
 */

export type DirectLinkMedium = 'CHAT' | 'AUDIO' | 'VIDEO';

export const DIRECT_LINK_MEDIA: DirectLinkMedium[] = ['CHAT', 'AUDIO', 'VIDEO'];

export interface DirectLink {
	id: string;
	/** Editable after creation, e.g. "Flyer Schule". */
	name: string;
	topic: string;
	/** Set once the link comes from UserService (#1894). */
	topicId?: number;
	agencyId?: number;
	/** Fixed after creation. */
	medium: DirectLinkMedium;
	/** New people get a temporary account. Applies to new people only. */
	temporary: boolean;
	active: boolean;
	url: string;
}

/** Grilling 2026-10-27: off for chat, on for calls; the counsellor can change it. */
export const defaultTemporary = (medium: DirectLinkMedium) => medium !== 'CHAT';
