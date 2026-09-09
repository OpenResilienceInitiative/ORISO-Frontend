/**
 * Copy map for the Teamberatung channel (Frank, 09.09.: "Dann steht dann
 * einfach **Teamberatung** statt Supervision").
 *
 * The i18n catalogue runs on a drift budget of 0 — this branch touches no
 * locale file. Every new word therefore lives HERE, once, and reaches the
 * components through the INJECTED `translate` as the default value of a key
 * the catalogue may define later: `translate(key, fallback)` hands back the
 * catalogue string once Weblate has one, and this German original until then.
 * So the words are translatable without a single locale file changing today.
 *
 * Keys mirror the supervision ones one-to-one (`supervision.panel.title` →
 * `chatStage.panel.team.title`) so the catalogue can be filled by analogy.
 */
export const TEAM_CHANNEL_COPY = {
	/** The channel word — the header line, the card row, the FAB label. */
	'chatStage.panel.team.title': 'Teamberatung',
	/** Role chip / kind word in the switcher. */
	'chatStage.switcher.kind.team': 'Teamberatung',
	/** Row in the channel card. */
	'chatStage.menu.teamChat': 'Teamberatung',
	/** Composer placeholder inside the team room. */
	'chatStage.panel.team.composer.placeholder': 'Nachricht an das Team …',
	/** First item of the room, like the supervision system notice (T7). */
	'chatStage.panel.team.systemNotice':
		'Die Teamberatung läuft parallel zur Beratung. Die ratsuchende Person ist hier nicht dabei und sieht davon nichts.',
	/** Empty room, before the first message. */
	'chatStage.panel.team.empty.title': 'Teamberatung starten',
	'chatStage.panel.team.empty.text':
		'Schreiben Sie unten die erste Nachricht an Ihr Team.'
} as const;

export type TeamChannelCopyKey = keyof typeof TEAM_CHANNEL_COPY;

/**
 * The shape of `useTranslation().t` this module needs — nothing more.
 * `defaultValue` is REQUIRED: that is the i18next overload we rely on
 * (`t(key, defaultValue)`), and it is the whole point — the German original
 * travels with the call instead of living in a locale file.
 */
export type TeamCopyTranslate = (key: string, defaultValue: string) => string;

/**
 * `const copy = teamCopy(translate); copy('chatStage.panel.team.title')`.
 * Injected, never imported from a global — so a story or a test can pass a
 * stub and assert the exact word without booting i18next.
 */
export const teamCopy =
	(translate: TeamCopyTranslate) =>
	(key: TeamChannelCopyKey): string =>
		translate(key, TEAM_CHANNEL_COPY[key]);
