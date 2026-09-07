import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import { ErstantwortSequence } from './ErstantwortSequence';
import { resolveErstantwortBausteine } from './erstantwortResolve';
import {
	ASSISTANT_NAME_TOKEN,
	AssistantNameProvider,
	DEFAULT_ASSISTANT_NAME,
	fillAssistantName
} from '../assistant/assistantName';
import { phone390Globals } from '../message/messageStoryShell';
import './ErstantwortSequence.styles.scss';

/**
 * **The assistant's name, as a platform-wide setting.**
 *
 * Frank, 2026-09-07: *"Wir sollten den Namen Carimat in globale Einstellung der
 * Plattformebene konfigurierbar machen."* Platform level explicitly — one name
 * per installation, not one per Träger, because Carimat is the **platform's own
 * voice** (`CONTEXT-erstantwort-und-carimat.md`, "Plattform-Stimme"). A Träger
 * authoring its own Baustein texts is the product; a Träger renaming the
 * platform's narrator is not.
 *
 * These stories are the proof that a different name travels through every
 * message the assistant sends, and that nothing about the layout was quietly
 * built around six letters.
 *
 * **What is being demonstrated**
 *
 * - The name is no longer written in the JSX of five components. Each of them
 *   now reads `useAssistantName()`, and the value comes from
 *   `AssistantNameProvider` — or, with no provider, from
 *   `DEFAULT_ASSISTANT_NAME`. Every render path in the app today has no
 *   provider, so today's pixels are unchanged.
 * - **Nothing here is wired to a backend.** There is no platform settings
 *   endpoint yet (see `VERDRAHTUNG-assistentenname-konfigurierbar-2026-09-07.md`),
 *   and this branch deliberately does not invent one.
 * - **No catalogue was touched.** `src/i18n.test.ts` runs a drift budget of 0
 *   for fr/ru/ti/tr, so the sentence stories inject their copy through a
 *   translate function, exactly as the sister modules do.
 *
 * **The layout property to watch in every story:** the kicker line is
 * `flex-direction: column` with `flex-wrap: wrap` (`PseudonymCard.styles.scss`),
 * so the name and the subtitle sit on their own lines and a long name wraps
 * rather than pushing the subtitle out of the card. Nothing truncates, and
 * nothing is `nowrap` — which is why the long-name story below is a check and
 * not a formality.
 */
const meta = {
	title: 'Components/Chat/AssistantName',
	component: ErstantwortSequence,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'One configurable platform-wide name, read by every assistant message building block through useAssistantName().'
			}
		}
	},
	globals: phone390Globals,
	args: { skipAnimation: true, onAction: () => undefined }
} satisfies Meta<typeof ErstantwortSequence>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The candidate names, and why each one is here rather than a prettier list.
 *
 * `SHORT` and `SPECIAL_CHARACTERS` are the two shapes a renaming committee
 * actually produces; `VERY_LONG` is not a proposal but the wrapping probe — it
 * is longer than any name anyone would pick, which is the point: if the header
 * survives 44 characters it survives everything shorter.
 */
const NAMES = {
	DEFAULT: DEFAULT_ASSISTANT_NAME,
	SHORT: 'Ari',
	VERY_LONG: 'Beratungsbegleiterin Rosalinde von Hohenstein',
	SPECIAL_CHARACTERS: 'Öz-Émile “Küçük” Ångström & Co.'
} as const;

/**
 * **The sentence copy-map.** These are the Bausteine whose German wording turns
 * from the platform's anonymous "wir/mir" into something that names the
 * narrator once the narrator has a configurable name — the four sentences the
 * analysis document lists as needing a `{{assistantName}}` placeholder in all
 * seven catalogues.
 *
 * They live here, not in `common.json`, on purpose: adding a key to the German
 * catalogue without the six translations trips the drift guard, and this branch
 * is a Storybook study, not the i18n change.
 */
const SENTENCE_COPY: Record<string, string> = {
	'erstantwort.greeting.body': `Schön, dass Sie sich gemeldet haben. Ihre Nachricht ist bei uns angekommen — ${ASSISTANT_NAME_TOKEN} begleitet Sie durch die ersten Schritte.`,
	'erstantwort.dataProtection.body': `Wie wir mit Ihren Daten umgehen, steht in der Datenschutzerklärung. ${ASSISTANT_NAME_TOKEN} liest Ihre Nachrichten nicht mit.`,
	'erstantwort.emailNotification.body': `Sie können freiwillig eine E-Mail-Adresse hinterlegen. Dann schreibt ${ASSISTANT_NAME_TOKEN} Ihnen kurz, sobald eine Antwort da ist. Der Inhalt der Beratung steht nie in dieser E-Mail.`,
	'erstantwort.closing.body': `Bis bald — wir melden uns bei Ihnen. Falls etwas unklar bleibt, fragen Sie ${ASSISTANT_NAME_TOKEN}.`
};

/**
 * The injected `translate` the sister modules use: fall back to the platform
 * default wording, and substitute the name where a sentence asks for it. Once
 * the catalogues carry `{{assistantName}}`, i18next does this itself and
 * `fillAssistantName` can be deleted.
 */
const translateFor =
	(name: string, copy: Record<string, string> = {}) =>
	(key: string, defaultValue?: string) =>
		fillAssistantName(copy[key] ?? defaultValue ?? '', name);

const sequenceFor = (name: string, copy?: Record<string, string>) =>
	resolveErstantwortBausteine({
		trigger: 'AFTER_FIRST_MESSAGE',
		context: { conversationType: 'AGENCY_COUNSELLING' },
		translate: translateFor(name, copy),
		state: {
			hasEmail: false,
			isTwoFactorEnabled: true,
			isTwoFactorActive: false
		}
	}).bausteine;

/** Every story renders the same sequence under a different configured name. */
const withName = (name: string, copy?: Record<string, string>): Story => ({
	args: { bausteine: sequenceFor(name, copy) },
	decorators: [
		(StoryFn) => (
			<AssistantNameProvider name={name}>
				<StoryFn />
			</AssistantNameProvider>
		)
	],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// Named once, in the kicker line — never repeated per bubble.
		await expect(await canvas.findAllByText(name)).toHaveLength(1);
		// The old literal must be gone unless it *is* the configured name.
		if (name !== DEFAULT_ASSISTANT_NAME) {
			await expect(canvas.queryByText(DEFAULT_ASSISTANT_NAME)).toBeNull();
		}
	}
});

/**
 * **Standard.** No platform setting configured — an installation that has never
 * opened the field, which is every installation today. The provider is still in
 * the tree, so this also proves the fallback: `AssistantNameProvider` treats a
 * blank value as "not configured" and the kicker line reads "Carimat" rather
 * than going blank.
 */
export const Standard: Story = {
	...withName(NAMES.DEFAULT),
	decorators: [
		(StoryFn) => (
			<AssistantNameProvider name="   ">
				<StoryFn />
			</AssistantNameProvider>
		)
	]
};

/**
 * **A short name.** Three letters, the far end of what a rename produces. The
 * kicker line is a flex column, so the subtitle keeps its own line and does not
 * slide up beside the name — the header's height is identical to `Standard`,
 * which is what keeps the sequence from jumping when the setting changes.
 */
export const ShortName: Story = withName(NAMES.SHORT);

/**
 * **A very long name — the wrapping probe.** 44 characters, longer than any
 * plausible proposal, deliberately.
 *
 * What to look for: the name wraps onto a second line **inside the header**,
 * the subtitle stays underneath it rather than being pushed out of the card,
 * and the bubbles below do not shift horizontally — the avatar column is a
 * fixed rail, and the header's `padding-left` is derived from the avatar's
 * visible edge, not from the text.
 *
 * If a future design ever adds `white-space: nowrap` or a `text-overflow` to
 * `.pseudonymCard__headerName`, this story is where it will show up as a
 * clipped name rather than a wrapped one.
 */
export const VeryLongName: Story = withName(NAMES.VERY_LONG);

/**
 * **A name with special characters.** Umlauts and a cedilla-height diacritic
 * (`ç`, `Å`), typographic quotation marks, an ampersand and a full stop.
 *
 * Two failure modes this rules out: the 16px/`line-height: 16px` kicker line
 * clipping ascenders and diacritics — the exact bug the subtitle line was
 * already fixed for — and the name being HTML-escaped or mangled on its way
 * through the render. It arrives as typed.
 */
export const SpecialCharacters: Story = withName(NAMES.SPECIAL_CHARACTERS);

/**
 * **The name inside a running sentence — the part that is not free.**
 *
 * Every story above changes one word in a kicker line. This one changes four
 * *sentences*, and that is the expensive half of the feature: a name in prose
 * needs a `{{assistantName}}` placeholder, and a placeholder has to be added to
 * the German key **and** its six translations, because
 * `collectPlaceholderDriftKeys` in `src/i18n.test.ts` fails any locale whose
 * value does not carry the same interpolations as the German source.
 *
 * The four sentences shown here are the ones the analysis document names:
 * `erstantwort.greeting.body`, `erstantwort.dataProtection.body`,
 * `erstantwort.emailNotification.body` and `erstantwort.closing.body`. They
 * are the places where today's copy says "wir" or "mir" and would say the name
 * instead.
 *
 * Note what is *not* here: the two safety-bearing Bausteine — "keine
 * persönlichen Daten" and the emergency numbers — keep the impersonal platform
 * voice. Putting a friendly narrator's name into the sentence about the
 * Telefonseelsorge would soften a text whose whole job is not to be soft.
 */
export const NameInsideSentences: Story = withName(NAMES.SHORT, SENTENCE_COPY);

/**
 * The same four sentences under the long name, because prose is where a long
 * name actually costs something: the kicker line wraps once, a sentence with a
 * 44-character name in the middle rewraps entirely and can leave a very short
 * last line. This is the story to look at before agreeing to a long name.
 */
export const LongNameInsideSentences: Story = withName(
	NAMES.VERY_LONG,
	SENTENCE_COPY
);
