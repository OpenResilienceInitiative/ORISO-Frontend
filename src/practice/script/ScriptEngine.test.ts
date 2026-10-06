import { describe, expect, it } from 'vitest';
import { PRACTICE_CAST } from '../fixtures/practiceCast';
import {
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_SUPERVISION_ROOM_ID,
	PRACTICE_TEAM_ROOM_ID
} from '../practiceIds';
import { practiceAcceptTour, practiceSupervisionTour } from '../practiceTours';
import {
	createScriptEngine,
	PRACTICE_SCRIPT_VERSION,
	type ScriptAction
} from './ScriptEngine';
import {
	createPracticeTestI18n,
	createTestScript,
	PRACTICE_SCRIPT_LOCALES,
	type PracticeScriptLocale
} from './scriptTestSupport';

/** Spec 3.6, German source, as approved: the engine must hand these out verbatim. */
const SPEC_DE = {
	askerFirstMessage:
		'Guten Tag, ich habe eine allgemeine Frage zu Ihrem Angebot. Wie läuft eine Beratung bei Ihnen ab, und wie schnell bekomme ich eine Antwort? Vielen Dank.',
	askerReply:
		'Vielen Dank für Ihre Antwort. Das hilft mir weiter. Ich melde mich, wenn ich noch Fragen habe.',
	teamColleagueMessage:
		'Ich bin heute im Termin und schaffe die Antwort nicht mehr. Kannst du die Anfrage übernehmen?',
	supervisorReply:
		'Das klingt gut so. Frag ruhig nach, was die Person genau wissen möchte. Ich lese mit und melde mich, wenn mir etwas auffällt.'
} as const;

const firstReply: ScriptAction = {
	type: 'counsellor-first-reply',
	roomId: PRACTICE_MAIN_ROOM_ID
};
const supervisorAdded: ScriptAction = { type: 'supervisor-added' };

describe('ScriptEngine', () => {
	it('maps the counsellor first reply in the case room to the scripted asker answer', () => {
		const script = createTestScript('de');

		expect(script.reactionFor(firstReply)).toEqual({
			roomId: PRACTICE_MAIN_ROOM_ID,
			sender: PRACTICE_CAST.asker.matrixUserId,
			body: SPEC_DE.askerReply
		});
	});

	it('maps supervisor-added to the supervisor reply in the supervision side room', () => {
		const script = createTestScript('de');

		expect(script.reactionFor(supervisorAdded)).toEqual({
			roomId: PRACTICE_SUPERVISION_ROOM_ID,
			sender: PRACTICE_CAST.supervisor.matrixUserId,
			body: SPEC_DE.supervisorReply
		});
	});

	it('hands out the approved German texts and cast names verbatim', () => {
		const script = createTestScript('de');

		expect(script.texts).toMatchObject({
			askerFirstMessage: SPEC_DE.askerFirstMessage,
			askerReply: SPEC_DE.askerReply,
			teamColleagueMessage: SPEC_DE.teamColleagueMessage,
			supervisorReply: SPEC_DE.supervisorReply
		});
		expect(script.cast.asker.displayName).toBe('Sam Muster (Übung)');
		expect(script.cast.colleague.displayName).toBe('Alex (Übung)');
		expect(script.cast.supervisor.displayName).toBe('Robin (Übung)');
	});

	it('keeps the cast identities and splits the localised display name into first and last name', () => {
		const { cast } = createTestScript('en');

		expect(cast.asker).toEqual({
			...PRACTICE_CAST.asker,
			displayName: 'Sam Muster (practice)',
			lastName: 'Muster (practice)'
		});
		expect(cast.colleague).toMatchObject({
			id: PRACTICE_CAST.colleague.id,
			displayName: 'Alex (practice)',
			firstName: 'Alex',
			lastName: '(practice)'
		});
	});

	it('gives no reaction to the first-reply action outside the case room', () => {
		const script = createTestScript('de');

		for (const roomId of [
			PRACTICE_TEAM_ROOM_ID,
			PRACTICE_SUPERVISION_ROOM_ID,
			'!real:matrix.example.org'
		]) {
			expect(
				script.reactionFor({ type: 'counsellor-first-reply', roomId })
			).toBeNull();
		}
	});

	it('gives no reaction to an action it does not know', () => {
		const script = createTestScript('de');

		expect(script.reactionFor({ type: 'time-passed' } as any)).toBeNull();
		expect(script.reactionFor(undefined as any)).toBeNull();
	});

	it('is not influenced by what the counsellor typed', () => {
		const script = createTestScript('de');
		const baseline = script.reactionFor(firstReply);

		for (const text of [
			'Hallo Sam',
			'',
			'Ich bin in Not, bitte helfen Sie sofort.',
			'<b>fett</b> {{askerReply}} $t(practiceScript.asker.reply)'
		]) {
			expect(
				script.reactionFor({ ...firstReply, text, body: text } as any)
			).toEqual(baseline);
		}
	});

	it('is deterministic: two engines and repeated calls give identical output', () => {
		for (const locale of PRACTICE_SCRIPT_LOCALES) {
			const a = createTestScript(locale);
			const b = createTestScript(locale);

			expect(b).toEqual({ ...a, reactionFor: expect.any(Function) });
			expect(a.reactionFor(firstReply)).toEqual(
				a.reactionFor(firstReply)
			);
			expect(a.reactionFor(supervisorAdded)).toEqual(
				b.reactionFor(supervisorAdded)
			);
		}
	});

	it('hands out a fresh reaction object each time, so a caller cannot change the script', () => {
		const script = createTestScript('de');

		const first = script.reactionFor(firstReply);
		(first as { body: string }).body = 'changed';

		expect(script.reactionFor(firstReply).body).toBe(SPEC_DE.askerReply);
	});

	it('resolves the locale once: a later language switch does not change an existing engine or a pinned one', async () => {
		const i18n = createPracticeTestI18n('en');
		const englishRun = createTestScript('en', i18n);
		const before = englishRun.reactionFor(firstReply);

		await i18n.changeLanguage('fr');

		expect(englishRun.locale).toBe('en');
		expect(englishRun.reactionFor(firstReply)).toEqual(before);
		// The translator now speaks French, but the engine pins its own locale.
		expect(createTestScript('en', i18n).texts.askerReply).toBe(
			englishRun.texts.askerReply
		);
		expect(createTestScript('fr', i18n).texts.askerReply).not.toBe(
			englishRun.texts.askerReply
		);
	});

	it('refuses a script version it has no texts for', () => {
		const i18n = createPracticeTestI18n('de');

		expect(() =>
			createScriptEngine({
				translate: (key, options) => String(i18n.t(key, options)),
				locale: 'de',
				scriptVersion: PRACTICE_SCRIPT_VERSION + 1
			})
		).toThrow(/script version/i);
	});

	it('ties the script version to the version of both practice tours', () => {
		expect(PRACTICE_SCRIPT_VERSION).toBe(1);
		expect(createTestScript('de').scriptVersion).toBe(
			PRACTICE_SCRIPT_VERSION
		);
		// A script change bumps the tour version: move both together.
		expect(practiceAcceptTour.version).toBe(PRACTICE_SCRIPT_VERSION);
		expect(practiceSupervisionTour.version).toBe(PRACTICE_SCRIPT_VERSION);
	});

	describe.each(PRACTICE_SCRIPT_LOCALES)('locale %s', (locale) => {
		const script = createTestScript(locale);
		const everyText = (): string[] => [
			...Object.values(script.texts),
			...Object.values(script.names),
			...Object.values(script.cast).map(({ displayName }) => displayName)
		];

		it('returns every text, none of them an unresolved key', () => {
			expect(script.locale).toBe(locale);
			expect(everyText().length).toBeGreaterThan(10);
			for (const text of everyText()) {
				expect(text.trim()).not.toBe('');
				expect(text).not.toMatch(/^practiceScript\./);
			}
		});

		it('keeps the invented names and marks each cast member as practice', () => {
			const { asker, colleague, supervisor } = script.cast;

			expect(asker.displayName).toMatch(/^Sam Muster \(.+\)$/);
			expect(colleague.displayName).toMatch(/^Alex \(.+\)$/);
			expect(supervisor.displayName).toMatch(/^Robin \(.+\)$/);
			expect(
				new Set([asker, colleague, supervisor].map(suffixOf)).size
			).toBe(1);
		});

		it('answers the first reply as the asker and the supervision add as the supervisor', () => {
			expect(script.reactionFor(firstReply)).toMatchObject({
				sender: PRACTICE_CAST.asker.matrixUserId,
				body: script.texts.askerReply
			});
			expect(script.reactionFor(supervisorAdded)).toMatchObject({
				sender: PRACTICE_CAST.supervisor.matrixUserId,
				body: script.texts.supervisorReply
			});
		});

		it('says four different things in four different speakers voices', () => {
			const spoken = [
				script.texts.askerFirstMessage,
				script.texts.askerReply,
				script.texts.teamColleagueMessage,
				script.texts.supervisorReply
			];

			expect(new Set(spoken).size).toBe(4);
		});
	});

	it.each(['fr', 'ru', 'ti', 'tr'] as PracticeScriptLocale[])(
		'does not serve English in %s',
		(locale) => {
			const english = createTestScript('en');
			const script = createTestScript(locale);

			expect(script.texts.askerFirstMessage).not.toBe(
				english.texts.askerFirstMessage
			);
			expect(script.texts.askerReply).not.toBe(english.texts.askerReply);
			expect(script.texts.teamColleagueMessage).not.toBe(
				english.texts.teamColleagueMessage
			);
			expect(script.texts.supervisorReply).not.toBe(
				english.texts.supervisorReply
			);
			expect(script.cast.asker.displayName).not.toBe(
				english.cast.asker.displayName
			);
		}
	);

	it('reads the same in de@informal as in de, because the script has no du-form to switch', () => {
		expect(createTestScript('de@informal').texts).toEqual(
			createTestScript('de').texts
		);
	});

	it('writes the asker formally and the colleagues informally in German', () => {
		const { texts } = createTestScript('de');

		expect(texts.askerFirstMessage).toMatch(/Ihrem Angebot/);
		expect(texts.askerReply).toMatch(/Ihre Antwort/);
		expect(texts.teamColleagueMessage).toMatch(/Kannst du/);
		expect(texts.supervisorReply).toMatch(/Frag ruhig/);
	});
});

/** The text after the first name, e.g. "practice" for "Sam Muster (practice)". */
function suffixOf(person: { displayName: string }): string {
	return /\(([^)]+)\)$/.exec(person.displayName)?.[1] ?? '';
}
