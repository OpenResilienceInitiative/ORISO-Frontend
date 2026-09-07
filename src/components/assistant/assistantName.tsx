import * as React from 'react';
import { createContext, useContext, useMemo } from 'react';

/**
 * **The assistant's name, in one place.**
 *
 * The platform speaks to advice seekers in its own voice — the robot avatar,
 * the kicker line, the staged bubbles of the Erstantwort (ADR-018). Today that
 * voice is called "Carimat", and the name is written out in the JSX of five
 * separate components plus one i18n key. Renaming the assistant therefore means
 * a code change in six files and a translation change in seven catalogues.
 *
 * Frank's decision of 2026-09-07 is that the name becomes a **platform-wide**
 * setting — one value for the whole installation, explicitly *not* per Träger,
 * so that a Träger cannot rebrand the platform's own voice.
 *
 * This module is the frontend half of that: a single source the message
 * building blocks read, instead of each of them knowing the name. Nothing here
 * fetches anything. The provider takes whatever the caller has (a tenant/public
 * settings response, a Storybook arg, a test fixture); when there is no
 * provider — which is every render path in the app today — the hook falls back
 * to {@link DEFAULT_ASSISTANT_NAME}, so this file can land ahead of the backend
 * without changing a single pixel.
 *
 * **Why a context and not a prop.** The name appears in the Erstantwort
 * sequence, the pseudonym card, the privacy notice, the breathing tutorial and
 * the case-handover notice. Those sit at very different depths under
 * `SessionItemComponent`; threading a prop through would touch every
 * intermediate component and would be undone by the next refactor. A context
 * read is one line at the leaf, and the leaf stops knowing the name.
 */

/**
 * The name shipped with the platform. Also the fallback whenever no value has
 * been configured — an empty configured name must never blank the kicker line,
 * so {@link AssistantNameProvider} treats blank input as "not configured".
 */
export const DEFAULT_ASSISTANT_NAME = 'Carimat';

/**
 * The i18next interpolation token for the name inside a running sentence.
 *
 * Deliberately the plain i18next `{{…}}` syntax rather than something bespoke:
 * once the seven catalogues gain the placeholder, `t(key, { assistantName })`
 * does the substitution for free and {@link fillAssistantName} can be deleted.
 * Until then it lets Storybook show what those sentences will look like without
 * touching a catalogue (the drift guard in `src/i18n.test.ts` has budget 0).
 */
export const ASSISTANT_NAME_TOKEN = '{{assistantName}}';

const AssistantNameContext = createContext<string>(DEFAULT_ASSISTANT_NAME);

export interface AssistantNameProviderProps {
	/**
	 * The configured name. `undefined`, `null` and blank all mean "not
	 * configured" and yield the platform default — a settings row that exists
	 * but was cleared must not leave bubbles signed by nobody.
	 */
	name?: string | null;
	children: React.ReactNode;
}

export const AssistantNameProvider: React.FC<AssistantNameProviderProps> = ({
	name,
	children
}) => {
	const value = useMemo(() => normaliseAssistantName(name), [name]);
	return (
		<AssistantNameContext.Provider value={value}>
			{children}
		</AssistantNameContext.Provider>
	);
};

/**
 * The name to print. Never empty: an unconfigured platform reads "Carimat".
 */
export const useAssistantName = (): string => useContext(AssistantNameContext);

/** Blank-safe reduction of a configured value to a printable name. */
export const normaliseAssistantName = (name?: string | null): string => {
	const trimmed = (name ?? '').trim();
	return trimmed.length > 0 ? trimmed : DEFAULT_ASSISTANT_NAME;
};

/**
 * Substitute the name into a sentence that carries {@link ASSISTANT_NAME_TOKEN}.
 *
 * This is what i18next's interpolation will do once the catalogues carry the
 * placeholder; it exists so the Storybook stories can demonstrate the sentence
 * form today. Text without the token is returned unchanged, so it is safe to
 * pipe every string through it.
 */
export const fillAssistantName = (text: string, name: string): string =>
	text.split(ASSISTANT_NAME_TOKEN).join(name);
