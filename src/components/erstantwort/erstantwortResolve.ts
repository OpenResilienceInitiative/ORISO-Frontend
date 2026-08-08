import {
	ErstantwortAction,
	ErstantwortBaustein,
	ErstantwortLink,
	parseErstantwortPayload
} from './erstantwortPayload';
import {
	ErstantwortModalityContext,
	ErstantwortTrigger,
	bausteinById,
	catalogueForTrigger
} from './erstantwortCatalogue';

/**
 * Turns either a persisted Erstantwort event or a client-side trigger into the
 * list of bubbles to render.
 *
 * Two sources, one output, and the precedence between them is the whole point:
 *
 * - **An event wins.** Its wording was frozen at send time (ADR-018 §4), so it
 *   is what the person was actually told and what a supervisory authority would
 *   be shown. The catalogue never overwrites it, not even for a Baustein whose
 *   default text has since changed.
 * - **The catalogue fills in where no event exists** — the post-dispatch
 *   trigger (ORISO-Frontend#825) produces no server event, and Storybook has no
 *   backend at all.
 *
 * Completion state is applied **last** and only ever removes a call to action,
 * never a body: the wording stays part of the record even once the person has
 * done the thing.
 */

/** Live state read at render time. Nothing here is stored in the event. */
export interface ErstantwortLiveState {
	hasEmail: boolean;
	/** Whether the tenant offers two-factor auth at all. */
	isTwoFactorEnabled: boolean;
	isTwoFactorActive: boolean;
	/**
	 * ORISO-Admin#602 switch 2. `undefined` means "not configured", which is
	 * treated as enabled — the setting is opt-out, and a tenant that has never
	 * seen the switch must keep today's behaviour.
	 */
	isAskerEmailEnabled?: boolean;
}

export interface ResolveErstantwortInput {
	/** A raw (decrypted) message body that may be a FIRST_RESPONSE event. */
	rawMessage?: string | null;
	/** Used only when no event is present. */
	trigger?: ErstantwortTrigger;
	context?: ErstantwortModalityContext & { deadlineDays?: number };
	translate: (key: string, defaultValue?: string) => string;
	state: ErstantwortLiveState;
}

export interface ResolvedBaustein {
	id: string;
	headline?: string;
	body: string;
	action?: ErstantwortAction;
	links?: ErstantwortLink[];
}

export interface ResolveErstantwortResult {
	status: 'ok' | 'unsupported-version' | 'none';
	bausteine: ResolvedBaustein[];
}

/** ADR-018: the platform default Antwortfrist, held as a number, never as prose. */
export const DEFAULT_RESPONSE_DEADLINE_DAYS = 2;

const applyPlaceholders = (
	text: string,
	values: Record<string, string | number>
): string =>
	Object.entries(values).reduce(
		(acc, [key, value]) =>
			acc.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value)),
		text
	);

/**
 * Whether an action should still be offered. Returns false once the underlying
 * state is satisfied — the pattern `FurtherSteps.tsx` already used for e-mail
 * (`const showAddEmail = !userData.email;`), generalised to every action kind.
 */
const isActionStillOpen = (
	action: ErstantwortAction,
	state: ErstantwortLiveState
): boolean => {
	switch (action.kind) {
		case 'ADD_EMAIL':
			return !state.hasEmail;
		case 'ENABLE_2FA':
			// Nothing to offer if the tenant does not run 2FA at all — a button
			// leading to a disabled settings page is worse than no button.
			return (
				Boolean(state.isTwoFactorEnabled) && !state.isTwoFactorActive
			);
		case 'SAVE_CREDENTIALS':
		case 'SET_DISPLAY_NAME':
			/* Neither has a "done" state anywhere in the system, and inventing
			   one would be exactly the new state ADR-018 §4 forbids. They stay
			   offered; re-rolling a name or re-saving credentials is harmless. */
			return true;
		default:
			return true;
	}
};

/**
 * ORISO-Admin#602 switch 2: with the e-mail invitation switched off the whole
 * Baustein disappears, not just its button. Leaving the prose would reproduce
 * exactly the contradiction the switch exists to remove — the chat inviting an
 * e-mail address that the Träger has decided not to collect.
 */
const isBausteinSilenced = (
	id: string,
	action: ErstantwortAction | undefined,
	state: ErstantwortLiveState
): boolean => {
	const emailRelated =
		id === 'emailNotification' || action?.kind === 'ADD_EMAIL';
	return emailRelated && state.isAskerEmailEnabled === false;
};

/**
 * `SAVE_CREDENTIALS` is dropped from any payload that carries it.
 *
 * The catalogue no longer emits it, but v1 events already persisted may, and the
 * wire format still accepts the kind — so removing it from the catalogue alone
 * protects nothing. Its affordance is the inline `SaveCredentialsCard`; a button
 * would render enabled and do nothing, which is the one thing this sequence must
 * never do.
 */
const dropUnactionableKinds = (
	bausteine: ResolvedBaustein[]
): ResolvedBaustein[] =>
	bausteine.map((baustein) => {
		if (baustein.action?.kind !== 'SAVE_CREDENTIALS') return baustein;
		const { action: _dropped, ...rest } = baustein;
		return rest;
	});

const applyLiveState = (
	bausteine: ResolvedBaustein[],
	state: ErstantwortLiveState
): ResolvedBaustein[] =>
	dropUnactionableKinds(bausteine)
		.filter(
			(baustein) =>
				!isBausteinSilenced(baustein.id, baustein.action, state)
		)
		.map((baustein) => {
			if (!baustein.action) return baustein;
			if (isActionStillOpen(baustein.action, state)) return baustein;
			const { action: _dropped, ...rest } = baustein;
			return rest;
		});

const fromEvent = (parsed: ErstantwortBaustein[]): ResolvedBaustein[] =>
	parsed.map((baustein) => ({
		id: baustein.id,
		headline: baustein.headline,
		body: baustein.body,
		action: baustein.action,
		links: baustein.links
	}));

const fromCatalogue = (
	trigger: ErstantwortTrigger,
	context: ErstantwortModalityContext & { deadlineDays?: number },
	translate: ResolveErstantwortInput['translate']
): ResolvedBaustein[] => {
	const placeholders = {
		deadlineDays: context.deadlineDays ?? DEFAULT_RESPONSE_DEADLINE_DAYS
	};

	return catalogueForTrigger(trigger, context)
		.map((entry) => {
			const body = applyPlaceholders(
				translate(entry.bodyKey, entry.defaultBody),
				placeholders
			).trim();
			/* An empty body means the Baustein has nothing to say — the
			   unfilled Freier Hinweis is the designed case. Rendering it would
			   produce a blank bubble in the middle of the sequence. */
			if (!body) return null;

			const headline = entry.headlineKey
				? applyPlaceholders(
						translate(entry.headlineKey, entry.defaultHeadline),
						placeholders
					).trim()
				: undefined;

			const resolved: ResolvedBaustein = { id: entry.id, body };
			if (headline) resolved.headline = headline;
			if (entry.action) {
				resolved.action = {
					kind: entry.action.kind,
					label: translate(
						entry.action.labelKey,
						entry.action.defaultLabel
					)
				};
			}
			return resolved;
		})
		.filter((entry): entry is ResolvedBaustein => entry !== null);
};

export const resolveErstantwortBausteine = ({
	rawMessage,
	trigger,
	context = {},
	translate,
	state
}: ResolveErstantwortInput): ResolveErstantwortResult => {
	const parsed = parseErstantwortPayload(rawMessage);

	if (parsed.status === 'unsupported-version') {
		/* Show nothing rather than a half-understood sequence. The event stays
		   persisted and a later frontend can render it correctly. */
		return { status: 'unsupported-version', bausteine: [] };
	}

	if (parsed.status === 'ok') {
		return {
			status: 'ok',
			bausteine: applyLiveState(fromEvent(parsed.bausteine), state)
		};
	}

	if (!trigger) return { status: 'none', bausteine: [] };

	return {
		status: 'ok',
		bausteine: applyLiveState(
			fromCatalogue(trigger, context, translate),
			state
		)
	};
};

/** Re-exported so consumers need only this module. */
export { bausteinById };
