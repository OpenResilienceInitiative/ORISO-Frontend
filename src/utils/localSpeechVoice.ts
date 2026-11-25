/*
 * Choosing a speech-synthesis voice that keeps the text on this device.
 *
 * Only voices with `localService === true` are ever chosen. Network voices
 * (Chrome's "Google …" voices and the like) send the text to a server, so
 * they are never picked, even when they are the only match or the default.
 * The macOS novelty voices (Albert, Zarvox, …) are left out too: they sing,
 * whisper or bubble instead of speaking. Within a language the voices of
 * `PREFERRED_VOICES` come first, then the default voice, then list order.
 */

/** macOS novelty voices; compared by the name before any " (…)" suffix. */
export const NOVELTY_VOICE_NAMES: readonly string[] = [
	'Albert',
	'Bad News',
	'Bahh',
	'Bells',
	'Boing',
	'Bubbles',
	'Cellos',
	'Good News',
	'Jester',
	'Organ',
	'Superstar',
	'Trinoids',
	'Whisper',
	'Wobble',
	'Zarvox'
];

/**
 * Voices to prefer per language, best first: the common macOS voices and
 * Windows' local "Microsoft …" voices (matched by prefix).
 */
export const PREFERRED_VOICES: Readonly<Record<string, readonly string[]>> = {
	de: [
		'Anna',
		'Petra',
		'Helena',
		'Yannick',
		'Markus',
		'Microsoft Katja',
		'Microsoft Hedda',
		'Microsoft Stefan'
	],
	en: [
		'Samantha',
		'Daniel',
		'Karen',
		'Moira',
		'Microsoft Zira',
		'Microsoft Aria',
		'Microsoft David',
		'Microsoft Mark'
	],
	fr: [
		'Amélie',
		'Thomas',
		'Audrey',
		'Microsoft Hortense',
		'Microsoft Julie',
		'Microsoft Paul'
	],
	ru: ['Milena', 'Yuri', 'Microsoft Irina', 'Microsoft Pavel'],
	tr: ['Yelda', 'Microsoft Tolga']
};

/** The app language as a BCP 47 base: `de@informal` → `de`. */
export const voiceLanguageOf = (locale: string): string =>
	(locale || '').split(/[@_-]/)[0].toLowerCase();

const languageOfVoice = (voice: Pick<SpeechSynthesisVoice, 'lang'>) =>
	(voice.lang || '').split(/[-_]/)[0].toLowerCase();

const baseName = (name: string) => (name || '').split(' (')[0].trim();

const isNovelty = (voice: Pick<SpeechSynthesisVoice, 'name'>) =>
	NOVELTY_VOICE_NAMES.includes(baseName(voice.name));

const preferenceRank = (
	voice: Pick<SpeechSynthesisVoice, 'name'>,
	language: string
): number => {
	const preferred = PREFERRED_VOICES[language] ?? [];
	const index = preferred.findIndex(
		(name) =>
			baseName(voice.name) === name || voice.name.startsWith(`${name} `)
	);
	return index === -1 ? Number.POSITIVE_INFINITY : index;
};

/**
 * A local, non-novelty voice for the language of `locale`, or null. Never a
 * network voice.
 */
export const pickLocalVoice = (
	voices: readonly SpeechSynthesisVoice[],
	locale: string
): SpeechSynthesisVoice | null => {
	const language = voiceLanguageOf(locale);
	if (!language) return null;
	const local = voices.filter(
		(voice) =>
			voice.localService === true &&
			languageOfVoice(voice) === language &&
			!isNovelty(voice)
	);
	if (local.length === 0) return null;
	const best = local.reduce<SpeechSynthesisVoice | null>((found, voice) => {
		const rank = preferenceRank(voice, language);
		if (rank === Number.POSITIVE_INFINITY) return found;
		return !found || rank < preferenceRank(found, language) ? voice : found;
	}, null);
	return best ?? local.find((voice) => voice.default) ?? local[0];
};
