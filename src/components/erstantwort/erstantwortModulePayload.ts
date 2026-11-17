import { SYSTEM_NOTIFICATION_PREFIX } from '../message/messageConstants';
import { SYSTEM_NOTIFICATION_FIRST_RESPONSE } from './erstantwortPayload';

/**
 * ADR-035 decision 8: the version-2 Erstantwort payload.
 *
 * Delivery is unchanged from ADR-018 — one `[SYSTEM_NOTIFICATION]` event with
 * the wording frozen at send time — but instead of a fixed Baustein catalogue
 * it carries the **resolved conversation module**: an ordered list of sections
 * the editor (platform, Träger, Beratungsstelle or the conversation itself)
 * arranged in the configurator.
 *
 * Version-1 events stay on `parseErstantwortPayload` and render as before. This
 * parser answers `none` for them, so a caller can try both without ordering
 * tricks.
 *
 * The same two invariants as version 1 hold:
 * - **Frozen words.** Every text arrives resolved to the conversation's
 *   language. Nothing here re-resolves it.
 * - **No stored state.** Whether a question block was answered or the e-mail
 *   is set is read live by the caller, never written into the event.
 */
export const ERSTANTWORT_MODULE_PAYLOAD_VERSION = 2;

export const ERSTANTWORT_SECTION_KINDS = [
	'message',
	'panel',
	'fixed',
	'questions'
] as const;
export type ErstantwortSectionKind = (typeof ERSTANTWORT_SECTION_KINDS)[number];

/** Platform components the editor may place but not write (decision 3). */
export const ERSTANTWORT_FIXED_MODULES = [
	'email',
	'consent',
	'accountCompletion'
] as const;
export type ErstantwortFixedModule = (typeof ERSTANTWORT_FIXED_MODULES)[number];

export const ERSTANTWORT_QUESTION_TYPES = [
	'text',
	'single',
	'multi',
	'hint'
] as const;
export type ErstantwortQuestionType =
	(typeof ERSTANTWORT_QUESTION_TYPES)[number];

/** Platform-assigned moments a question block may wait for (decision 7). */
export const ERSTANTWORT_QUESTION_TRIGGERS = [
	'withGreeting',
	'afterFirstReply'
] as const;
export type ErstantwortQuestionTrigger =
	(typeof ERSTANTWORT_QUESTION_TRIGGERS)[number];

export type ErstantwortDisplay = 'open' | 'collapsed';

export interface ErstantwortQuestionOption {
	id: string;
	label: string;
}

export interface ErstantwortQuestion {
	id: string;
	/** Stored with every answer, so a later edit never changes an old answer's meaning. */
	version: number;
	type: ErstantwortQuestionType;
	/** Only for single select: radio buttons or a select field (decision 9). */
	display?: 'radio' | 'dropdown';
	required: boolean;
	label: string;
	help?: string;
	options: ErstantwortQuestionOption[];
}

interface SectionBase {
	id: string;
}

export interface ErstantwortMessageSection extends SectionBase {
	kind: 'message';
	body: string;
}

export interface ErstantwortPanelSection extends SectionBase {
	kind: 'panel';
	title: string;
	display: ErstantwortDisplay;
	body: string;
	/** Emergency numbers and similar; drawn as the red emergency row. */
	safety?: boolean;
}

export interface ErstantwortFixedSection extends SectionBase {
	kind: 'fixed';
	title?: string;
	module: ErstantwortFixedModule;
}

export interface ErstantwortQuestionsSection extends SectionBase {
	kind: 'questions';
	title?: string;
	display: ErstantwortDisplay;
	trigger: ErstantwortQuestionTrigger;
	questions: ErstantwortQuestion[];
}

export type ErstantwortSection =
	| ErstantwortMessageSection
	| ErstantwortPanelSection
	| ErstantwortFixedSection
	| ErstantwortQuestionsSection;

export type ErstantwortModuleParseResult =
	| {
			status: 'ok';
			version: typeof ERSTANTWORT_MODULE_PAYLOAD_VERSION;
			conversationType?: string;
			sections: ErstantwortSection[];
	  }
	| { status: 'none'; conversationType?: undefined; sections: [] };

const NONE: ErstantwortModuleParseResult = { status: 'none', sections: [] };

const text = (value: unknown): string | undefined =>
	typeof value === 'string' && value.trim() ? value.trim() : undefined;

const oneOf = <T extends string>(
	allowed: readonly T[],
	value: unknown
): T | undefined =>
	typeof value === 'string' && (allowed as readonly string[]).includes(value)
		? (value as T)
		: undefined;

const normaliseOptions = (raw: unknown): ErstantwortQuestionOption[] =>
	(Array.isArray(raw) ? raw : [])
		.map((entry) => {
			const id = text((entry as { id?: unknown })?.id);
			const label = text((entry as { label?: unknown })?.label);
			return id && label ? { id, label } : null;
		})
		.filter((entry): entry is ErstantwortQuestionOption => entry !== null);

const normaliseQuestion = (raw: unknown): ErstantwortQuestion | null => {
	if (!raw || typeof raw !== 'object') return null;
	const source = raw as Record<string, unknown>;
	const id = text(source.id);
	const label = text(source.label);
	const type = oneOf(ERSTANTWORT_QUESTION_TYPES, source.type);
	if (!id || !label || !type) return null;

	const isChoice = type === 'single' || type === 'multi';
	const options = isChoice ? normaliseOptions(source.options) : [];
	/* A choice with fewer than two options cannot be answered honestly; the
	   configurator never publishes one, so this is a corrupt payload. */
	if (isChoice && options.length < 2) return null;

	const version =
		typeof source.version === 'number' && Number.isInteger(source.version)
			? source.version
			: 1;
	const question: ErstantwortQuestion = {
		id,
		version,
		type,
		required: type !== 'hint' && source.required === true,
		label,
		options
	};
	if (type === 'single') {
		question.display =
			oneOf(['radio', 'dropdown'] as const, source.display) ?? 'radio';
	}
	const help = text(source.help);
	if (help) question.help = help;
	return question;
};

const normaliseSection = (raw: unknown): ErstantwortSection | null => {
	if (!raw || typeof raw !== 'object') return null;
	const source = raw as Record<string, unknown>;
	const id = text(source.id);
	const kind = oneOf(ERSTANTWORT_SECTION_KINDS, source.kind);
	if (!id || !kind) return null;
	const title = text(source.title);
	const body = text(source.body);
	const display: ErstantwortDisplay =
		source.display === 'open' ? 'open' : 'collapsed';

	switch (kind) {
		case 'message':
			return body ? { id, kind, body } : null;
		case 'panel':
			/* A panel is a titled disclosure; without a title there is nothing
			   to tap, and without a body nothing to show. */
			if (!title || !body) return null;
			return source.safety === true
				? { id, kind, title, display, body, safety: true }
				: { id, kind, title, display, body };
		case 'fixed': {
			const module = oneOf(ERSTANTWORT_FIXED_MODULES, source.module);
			if (!module) return null;
			return title ? { id, kind, module, title } : { id, kind, module };
		}
		case 'questions': {
			const questions = (
				Array.isArray(source.questions) ? source.questions : []
			)
				.map(normaliseQuestion)
				.filter(
					(entry): entry is ErstantwortQuestion => entry !== null
				);
			if (!questions.length) return null;
			const section: ErstantwortQuestionsSection = {
				id,
				kind,
				/* A question block shows its questions unless the editor
				   collapsed it on purpose. */
				display: source.display === 'collapsed' ? 'collapsed' : 'open',
				trigger:
					oneOf(ERSTANTWORT_QUESTION_TRIGGERS, source.trigger) ??
					'withGreeting',
				questions
			};
			if (title) section.title = title;
			return section;
		}
		default:
			return null;
	}
};

/** Extracts a version-2 module from a raw (decrypted) message body. */
export const parseErstantwortModule = (
	rawMessage?: string | null
): ErstantwortModuleParseResult => {
	if (!rawMessage || typeof rawMessage !== 'string') return NONE;
	const trimmed = rawMessage.trimStart();
	if (!trimmed.startsWith(SYSTEM_NOTIFICATION_PREFIX)) return NONE;

	let parsed: unknown;
	try {
		parsed = JSON.parse(
			trimmed.substring(SYSTEM_NOTIFICATION_PREFIX.length).trim()
		);
	} catch {
		return NONE;
	}
	if (!parsed || typeof parsed !== 'object') return NONE;
	const { type, version, sections, conversationType } = parsed as Record<
		string,
		unknown
	>;
	if (type !== SYSTEM_NOTIFICATION_FIRST_RESPONSE) return NONE;
	if (version !== ERSTANTWORT_MODULE_PAYLOAD_VERSION) return NONE;

	return {
		status: 'ok',
		version: ERSTANTWORT_MODULE_PAYLOAD_VERSION,
		conversationType: text(conversationType),
		sections: (Array.isArray(sections) ? sections : [])
			.map(normaliseSection)
			.filter((entry): entry is ErstantwortSection => entry !== null)
	};
};
