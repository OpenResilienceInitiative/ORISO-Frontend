/**
 * Copy map for the Teamberatung channel (Frank, 09.09.: "Dann steht dann
 * einfach **Teamberatung** statt Supervision").
 *
 * All copy lives in the locale catalogues. This module only centralises the
 * typed keys and keeps translation injection convenient for stories/tests.
 *
 * Keys mirror the supervision ones one-to-one (`supervision.panel.title` →
 * `chatStage.panel.team.title`) so the catalogue can be filled by analogy.
 */
export const TEAM_CHANNEL_KEYS = {
	/** The channel word — the header line, the card row, the FAB label. */
	'chatStage.panel.team.title': 'chatStage.panel.team.title',
	/** Role chip / kind word in the switcher. */
	'chatStage.switcher.kind.team': 'chatStage.switcher.kind.team',
	/** Row in the channel card. */
	'chatStage.menu.teamChat': 'chatStage.menu.teamChat',
	/**
	 * ADR-016 §6: a PERMANENT "team-only" marker, "so a counsellor is never
	 * unsure which side they are writing on". It rides in the header chip,
	 * not in the timeline: a system notice at the top scrolls away, and a
	 * marker that scrolls away is not permanent. Sibling of the existing
	 * `teamDiscussion.teamOnlyMarker` in the older panel — same promise,
	 * shorter, because a header chip has no room for a sentence.
	 */
	'chatStage.panel.team.onlyMarker': 'chatStage.panel.team.onlyMarker',
	/**
	 * The channel card's own title. The catalogue's `chatStage.menu.title`
	 * says "Threads und Supervision" and would be a lie the moment a third
	 * kind is in the list — so this one replaces it ONLY while a team room
	 * is actually listed. A card with two kinds keeps the old wording.
	 */
	'chatStage.menu.titleWithTeam': 'chatStage.menu.titleWithTeam',
	/** Composer placeholder inside the team room. */
	'chatStage.panel.team.composer.placeholder':
		'chatStage.panel.team.composer.placeholder',
	/** First item of the room, like the supervision system notice (T7). */
	'chatStage.panel.team.systemNotice': 'chatStage.panel.team.systemNotice',
	/** Empty room, before the first message. */
	'chatStage.panel.team.empty.title': 'chatStage.panel.team.empty.title',
	'chatStage.panel.team.empty.text': 'chatStage.panel.team.empty.text'
} as const;

export type TeamChannelCopyKey = keyof typeof TEAM_CHANNEL_KEYS;

/**
 * The shape of `useTranslation().t` this module needs — nothing more.
 */
export type TeamCopyTranslate = (key: string) => string;

/**
 * `const copy = teamCopy(translate); copy('chatStage.panel.team.title')`.
 * Injected, never imported from a global — so a story or a test can pass a
 * stub and assert the exact word without booting i18next.
 */
export const teamCopy =
	(translate: TeamCopyTranslate) =>
	(key: TeamChannelCopyKey): string =>
		translate(TEAM_CHANNEL_KEYS[key]);
