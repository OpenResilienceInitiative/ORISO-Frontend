import {
	PRACTICE_CAST,
	type PracticePerson,
	type PracticePersonKey
} from '../fixtures/practiceCast';
import {
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_SUPERVISION_ROOM_ID
} from '../practiceIds';

/**
 * The script texts are versioned with the practice tour version: a
 * script change bumps both. A test pins the two together.
 */
export const PRACTICE_SCRIPT_VERSION = 1;

/** Pinned to `lng` by the engine, so a later language switch cannot leak in. */
export type ScriptTranslate = (key: string, options: { lng: string }) => string;

/** Things the counsellor did. Never time, never what was typed. */
export type ScriptAction =
	| { type: 'counsellor-first-reply'; roomId: string }
	| { type: 'supervisor-added' };

export interface ScriptReaction {
	roomId: string;
	/** Practice Matrix user id of the speaker. */
	sender: string;
	body: string;
}

export interface ScriptTexts {
	askerFirstMessage: string;
	askerReply: string;
	teamColleagueMessage: string;
	supervisorReply: string;
	erstantwortGreeting: string;
	acceptedCaseCounsellorMessage: string;
}

export interface ScriptNames {
	agency: string;
	topic: string;
	teamRoom: string;
	supervisionRoom: string;
}

export interface ScriptEngine {
	readonly locale: string;
	readonly scriptVersion: number;
	readonly cast: Readonly<Record<PracticePersonKey, PracticePerson>>;
	readonly texts: Readonly<ScriptTexts>;
	readonly names: Readonly<ScriptNames>;
	/** `null` when the action has no scripted reaction. */
	reactionFor(action: ScriptAction): ScriptReaction | null;
}

const person = (
	key: PracticePersonKey,
	displayName: string
): PracticePerson => {
	const { firstName } = PRACTICE_CAST[key];
	const rest = displayName.startsWith(firstName)
		? displayName.slice(firstName.length).trim()
		: displayName;
	return { ...PRACTICE_CAST[key], displayName, lastName: rest };
};

/**
 * Maps counsellor actions to scripted reactions. Pure: it reads
 * the texts once, in the one locale chosen when practice started, and then
 * only looks them up. No timers, no randomness, no AI, and the typed text
 * never reaches it, so every run says the same thing.
 */
export const createScriptEngine = ({
	translate,
	locale,
	scriptVersion = PRACTICE_SCRIPT_VERSION
}: {
	translate: ScriptTranslate;
	locale: string;
	scriptVersion?: number;
}): ScriptEngine => {
	if (scriptVersion !== PRACTICE_SCRIPT_VERSION) {
		throw new Error(
			`No practice script version ${scriptVersion}; this build has ${PRACTICE_SCRIPT_VERSION}`
		);
	}
	// Literal keys on purpose: the i18n guard (`src/i18n.test.ts`) reads them.
	const t = (key: string) => translate(key, { lng: locale });

	const cast = {
		asker: person('asker', t('practiceScript.cast.asker')),
		colleague: person('colleague', t('practiceScript.cast.colleague')),
		supervisor: person('supervisor', t('practiceScript.cast.supervisor'))
	};
	const texts: ScriptTexts = {
		askerFirstMessage: t('practiceScript.asker.firstMessage'),
		askerReply: t('practiceScript.asker.reply'),
		teamColleagueMessage: t('practiceScript.colleague.teamMessage'),
		supervisorReply: t('practiceScript.supervisor.reply'),
		erstantwortGreeting: t('practiceScript.erstantwort.greeting'),
		acceptedCaseCounsellorMessage: t(
			'practiceScript.counsellor.acceptedCaseMessage'
		)
	};
	const names: ScriptNames = {
		agency: t('practiceScript.names.agency'),
		topic: t('practiceScript.names.topic'),
		teamRoom: t('practiceScript.names.teamRoom'),
		supervisionRoom: t('practiceScript.names.supervisionRoom')
	};

	return {
		locale,
		scriptVersion,
		cast,
		texts,
		names,
		reactionFor: (action) => {
			switch (action?.type) {
				case 'counsellor-first-reply':
					return action.roomId === PRACTICE_MAIN_ROOM_ID
						? {
								roomId: PRACTICE_MAIN_ROOM_ID,
								sender: cast.asker.matrixUserId,
								body: texts.askerReply
							}
						: null;
				case 'supervisor-added':
					return {
						roomId: PRACTICE_SUPERVISION_ROOM_ID,
						sender: cast.supervisor.matrixUserId,
						body: texts.supervisorReply
					};
				default:
					return null;
			}
		}
	};
};
