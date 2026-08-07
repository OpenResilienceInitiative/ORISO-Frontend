import { SYSTEM_NOTIFICATION_PREFIX } from '../message/messageConstants';

/**
 * ADR-018: the Erstantwort is delivered as **one** persisted
 * `[SYSTEM_NOTIFICATION]` event carrying a **versioned** structured payload,
 * rendered client-side as a staged sequence of Carimat bubbles.
 *
 * This module owns the frontend half of that contract. The UserService half is
 * ORISO-UserService#926 — both sides key off the constants below, so a change
 * here is a change to the wire format and needs the version bumped.
 *
 * Two invariants from ADR-018 §4 ("frozen words, live state") shape the shape:
 *
 * - The **wording is frozen** into the event, so what was said to the person is
 *   provable later and a subsequent configuration change does not rewrite
 *   history. Nothing here re-resolves text at render time.
 * - **Completion state is never stored.** An action Baustein carries only its
 *   `kind`; whether it is already done is read live from `userData` at render
 *   time (e-mail present, 2FA active, …). Someone who adds their e-mail in
 *   their profile therefore sees the Baustein as done retroactively.
 */

/** `type` discriminator inside the `[SYSTEM_NOTIFICATION]` JSON body. */
export const SYSTEM_NOTIFICATION_FIRST_RESPONSE = 'FIRST_RESPONSE';

/**
 * Wire-format version. Bump on any breaking change to the payload shape; a
 * frontend that meets a higher version renders nothing rather than guessing
 * (ADR-018 "Cost": a structured payload needs versioning, or a later frontend
 * renders old events wrongly — and the inverse is just as true).
 */
export const ERSTANTWORT_PAYLOAD_VERSION = 1;

/**
 * The actions an Erstantwort Baustein may offer. Every one of them reaches an
 * already-working routed endpoint or an existing in-app route — ADR-018 §4
 * forbids introducing new state for a Baustein.
 */
export const ERSTANTWORT_ACTION_KINDS = [
	'ADD_EMAIL',
	'ENABLE_2FA',
	'SAVE_CREDENTIALS',
	'SET_DISPLAY_NAME'
] as const;

export type ErstantwortActionKind = (typeof ERSTANTWORT_ACTION_KINDS)[number];

export interface ErstantwortAction {
	kind: ErstantwortActionKind;
	label: string;
}

export interface ErstantwortLink {
	label: string;
	url: string;
}

export interface ErstantwortBaustein {
	/** Stable catalogue id — used for keys, stories and telemetry, never shown. */
	id: string;
	/** Optional headline above the body. */
	headline?: string;
	/** The resolved, frozen wording. Always present and non-blank. */
	body: string;
	/** Optional call to action; absent when the Baustein is purely informational. */
	action?: ErstantwortAction;
	/** Derived link targets (department DPP / Imprint, emergency pages). */
	links?: ErstantwortLink[];
}

export type ErstantwortParseResult =
	| { status: 'ok'; version: number; bausteine: ErstantwortBaustein[] }
	| { status: 'unsupported-version'; version: number; bausteine: [] }
	| { status: 'none'; version: null; bausteine: [] };

const NONE: ErstantwortParseResult = {
	status: 'none',
	version: null,
	bausteine: []
};

/**
 * Only absolute http(s) targets survive. A `javascript:` or `data:` URL in a
 * server-resolved link would be a stored-XSS vector the moment it is rendered
 * into an anchor, and no legitimate DPP/Imprint target needs another scheme.
 */
const isSafeHttpUrl = (value: unknown): value is string => {
	if (typeof value !== 'string' || !value.trim()) return false;
	/* `window` is genuinely absent in the unit-test and any SSR context, and a
	   bare `window?.` does not protect against an *undeclared* identifier — it
	   still throws a ReferenceError. Resolve the base defensively so a relative
	   `/impressum` target stays parseable in the browser without the whole
	   check silently collapsing to "unsafe" everywhere else. */
	const base =
		typeof window !== 'undefined'
			? window.location?.origin
			: 'http://x.invalid';
	try {
		const { protocol } = new URL(value, base);
		return protocol === 'http:' || protocol === 'https:';
	} catch {
		return false;
	}
};

const isKnownActionKind = (value: unknown): value is ErstantwortActionKind =>
	typeof value === 'string' &&
	(ERSTANTWORT_ACTION_KINDS as readonly string[]).includes(value);

const normaliseAction = (raw: unknown): ErstantwortAction | undefined => {
	if (!raw || typeof raw !== 'object') return undefined;
	const { kind, label } = raw as { kind?: unknown; label?: unknown };
	/* An unknown kind is dropped rather than rendered as a dead button: a
	   button that does nothing is worse than no button, especially in the
	   message that is supposed to be the transparency record. */
	if (!isKnownActionKind(kind)) return undefined;
	if (typeof label !== 'string' || !label.trim()) return undefined;
	return { kind, label: label.trim() };
};

const normaliseLinks = (raw: unknown): ErstantwortLink[] | undefined => {
	if (!Array.isArray(raw)) return undefined;
	const links = raw
		.map((entry) => {
			if (!entry || typeof entry !== 'object') return null;
			const { label, url } = entry as { label?: unknown; url?: unknown };
			if (typeof label !== 'string' || !label.trim()) return null;
			if (!isSafeHttpUrl(url)) return null;
			return { label: label.trim(), url };
		})
		.filter((entry): entry is ErstantwortLink => entry !== null);
	return links.length ? links : undefined;
};

const normaliseBaustein = (raw: unknown): ErstantwortBaustein | null => {
	if (!raw || typeof raw !== 'object') return null;
	const { id, headline, body } = raw as {
		id?: unknown;
		headline?: unknown;
		body?: unknown;
	};
	if (typeof id !== 'string' || !id.trim()) return null;
	/* A Baustein with no body has nothing to say. Dropping it keeps a partially
	   corrupt payload readable instead of rendering an empty bubble. */
	if (typeof body !== 'string' || !body.trim()) return null;

	const baustein: ErstantwortBaustein = { id: id.trim(), body: body.trim() };
	if (typeof headline === 'string' && headline.trim()) {
		baustein.headline = headline.trim();
	}
	const action = normaliseAction((raw as { action?: unknown }).action);
	if (action) baustein.action = action;
	const links = normaliseLinks((raw as { links?: unknown }).links);
	if (links) baustein.links = links;
	return baustein;
};

/**
 * Extracts the Erstantwort Bausteine from a raw (already decrypted) message
 * body. Returns `none` for every message that is not a FIRST_RESPONSE event —
 * callers can pass any message body without pre-filtering.
 */
export const parseErstantwortPayload = (
	rawMessage?: string | null
): ErstantwortParseResult => {
	if (!rawMessage || typeof rawMessage !== 'string') return NONE;
	const trimmed = rawMessage.trimStart();
	if (!trimmed.startsWith(SYSTEM_NOTIFICATION_PREFIX)) return NONE;

	let parsed: unknown;
	try {
		parsed = JSON.parse(
			trimmed.substring(SYSTEM_NOTIFICATION_PREFIX.length).trim()
		);
	} catch {
		/* A non-JSON body is a legacy plain-text system notification. Not ours. */
		return NONE;
	}
	if (!parsed || typeof parsed !== 'object') return NONE;

	const { type, version, bausteine } = parsed as {
		type?: unknown;
		version?: unknown;
		bausteine?: unknown;
	};
	if (type !== SYSTEM_NOTIFICATION_FIRST_RESPONSE) return NONE;

	/* An absent version is not "obviously v1": it is a payload written by
	   something that does not know the contract, so it is exactly as unsafe to
	   render as a future one. Report it as unsupported and show nothing. */
	if (typeof version !== 'number' || !Number.isFinite(version)) {
		return { status: 'unsupported-version', version: NaN, bausteine: [] };
	}
	if (version > ERSTANTWORT_PAYLOAD_VERSION) {
		return { status: 'unsupported-version', version, bausteine: [] };
	}

	const normalised = (Array.isArray(bausteine) ? bausteine : [])
		.map(normaliseBaustein)
		.filter((entry): entry is ErstantwortBaustein => entry !== null);

	return { status: 'ok', version, bausteine: normalised };
};

/** True when this message body is an Erstantwort event of any version. */
export const isErstantwortMessage = (rawMessage?: string | null): boolean =>
	parseErstantwortPayload(rawMessage).status !== 'none';
