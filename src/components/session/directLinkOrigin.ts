import { getModalityIfKnown, Modality, ModalityInput } from './getModality';

/**
 * FE#1952 — where a conversation came from, when it came through a counsellor
 * direct link (#1475, ADR-029): the link's medium, sent by ORISO-UserService
 * as `SessionDTO.directLinkMedium`.
 *
 * This is a LABEL, not a modality. ADR-006 keeps the four modalities, and a
 * direct-link conversation stays `AGENCY_COUNSELLING`; only the word in the
 * counsellor's list changes from "Mail" to "Videoanruf", "Audioanruf" or
 * "Direktlink". So the origin is read only for agency counselling: a live
 * chat or a group never carries one, whatever a field says.
 */
export type DirectLinkMedium = 'CHAT' | 'AUDIO' | 'VIDEO';

const DIRECT_LINK_MEDIA: readonly DirectLinkMedium[] = [
	'CHAT',
	'AUDIO',
	'VIDEO'
];

const isDirectLinkMedium = (value: unknown): value is DirectLinkMedium =>
	typeof value === 'string' &&
	(DIRECT_LINK_MEDIA as readonly string[]).includes(value);

/** The direct-link medium of a 1:1 conversation, or undefined. */
export const getDirectLinkMedium = (
	input?: ModalityInput
): DirectLinkMedium | undefined => {
	if (!input) {
		return undefined;
	}
	const session =
		'item' in input
			? input.isGroup
				? undefined
				: input.item
			: (input as { session?: unknown }).session;
	const medium = (session as { directLinkMedium?: unknown } | undefined)
		?.directLinkMedium;
	if (!isDirectLinkMedium(medium)) {
		return undefined;
	}
	return getModalityIfKnown(input) === Modality.AGENCY_COUNSELLING
		? medium
		: undefined;
};

const LABEL_KEYS: Record<DirectLinkMedium, string> = {
	VIDEO: 'sessionList.item.sessionType.directLinkVideo',
	AUDIO: 'sessionList.item.sessionType.directLinkAudio',
	CHAT: 'sessionList.item.sessionType.directLinkChat'
};

/** i18n key of the list chip / rail mark for a direct-link medium. */
export const directLinkLabelKey = (medium: DirectLinkMedium): string =>
	LABEL_KEYS[medium];
