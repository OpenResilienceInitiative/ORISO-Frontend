/**
 * How a translation is kept honest.
 *
 * German is the source. Every other variant is a derivative, and a derivative
 * rots silently: someone improves a German sentence, the five translations keep
 * saying the old thing, and nothing anywhere goes red. This module is the part
 * that goes red.
 *
 * Two fingerprints per occasion per locale, recorded in
 * `translationManifest.json`:
 *
 *   `source` — the German occasion as it stood when the translation was made
 *   `target` — the translation as it stood when it was stamped
 *
 * From those two, the three failure modes separate cleanly:
 *
 *   | `source` matches | `target` matches | means                                   |
 *   | ---------------- | ---------------- | --------------------------------------- |
 *   | yes              | yes              | in sync                                 |
 *   | **no**           | yes              | German moved, the translation did not   |
 *   | yes              | **no**           | translation edited without re-stamping  |
 *   | no               | no               | both moved — re-stamp and review        |
 *
 * `npm run emails:sync` writes the manifest and refuses the second row, which
 * is the one that would otherwise launder stale copy into a green build.
 *
 * The hash is a plain FNV-1a pair rather than `node:crypto`, because this
 * module is imported by the Storybook previews as well as by the build script,
 * and a preview runs in a browser.
 */

import { EmailContent } from '../kit/emailTemplate';
import {
	EmailId,
	EmailLocale,
	EmailLocaleRelease,
	EmailTranslationProvenance,
	emailProtectedPaths
} from './emailCatalogue';

/** A string inside `EmailContent`, with the dotted path that addresses it. */
export interface EmailContentString {
	/** e.g. `subject`, `paragraphs.1`, `panel.0.label`, `footer.links.2.label`. */
	path: string;
	value: string;
}

const walk = (node: unknown, path: string, out: EmailContentString[]): void => {
	if (typeof node === 'string') {
		out.push({ path, value: node });
		return;
	}
	if (Array.isArray(node)) {
		node.forEach((item, index) =>
			walk(item, path ? `${path}.${index}` : String(index), out)
		);
		return;
	}
	if (node && typeof node === 'object') {
		Object.entries(node).forEach(([key, value]) =>
			walk(value, path ? `${path}.${key}` : key, out)
		);
	}
};

/**
 * Every string in an occasion, sorted by path.
 *
 * Sorted so that reordering the fields of a content object — which changes
 * nothing a recipient sees — does not read as a copy change.
 */
export const emailContentStrings = (
	content: EmailContent
): EmailContentString[] => {
	const out: EmailContentString[] = [];
	walk(content, '', out);
	return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
};

/**
 * FNV-1a, twice, with different offsets — 64 bits of hex.
 *
 * Not a security primitive and not trying to be. It answers exactly one
 * question: is this the same string as the one that was translated?
 */
export const emailFingerprint = (value: string): string => {
	let a = 0x811c9dc5;
	let b = 0xc59d1c81;
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		a = Math.imul(a ^ code, 0x01000193);
		b = Math.imul(b ^ code, 0x85ebca6b);
	}
	return (
		(a >>> 0).toString(16).padStart(8, '0') +
		(b >>> 0).toString(16).padStart(8, '0')
	);
};

/** Fingerprint of a whole occasion: every path and every value. */
export const emailOccasionFingerprint = (content: EmailContent): string =>
	emailFingerprint(
		emailContentStrings(content)
			.map(({ path, value }) => `${path}\u0000${value}`)
			.join('\u0001')
	);

/** Turns `panel.*.label` into a matcher; `*` stands for one array index. */
const pathMatcher = (pattern: string): RegExp =>
	new RegExp(
		`^${pattern
			.split('.')
			.map((segment) =>
				segment === '*'
					? '\\d+'
					: segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			)
			.join('\\.')}$`
	);

/**
 * Whether a string is translatable text at all.
 *
 * `{{messageBody}}` is a slot the sending service fills, not copy — asking a
 * reviewer to sign off on it would be asking them to sign off on punctuation.
 */
export const emailStringIsTranslatable = (value: string): boolean =>
	/\p{L}/u.test(value.replace(/\{\{\s*[\w.]+\s*\}\}/g, ''));

/**
 * The strings in one occasion that a machine may not translate unreviewed.
 *
 * See `emailProtectedPaths` for what is on the list and why.
 */
export const emailProtectedStrings = (
	content: EmailContent,
	id: EmailId
): EmailContentString[] => {
	const matchers = emailProtectedPaths(id).map(pathMatcher);
	return emailContentStrings(content).filter(
		({ path, value }) =>
			matchers.some((matcher) => matcher.test(path)) &&
			emailStringIsTranslatable(value)
	);
};

/**
 * Every distinct protected string in a whole locale, keyed by fingerprint.
 *
 * Distinct by *value*: the encryption promise closes all 22 mails, and signing
 * it off once per language is the point of the exercise.
 */
export const emailProtectedStringIndex = (
	content: Record<EmailId, EmailContent>,
	ids: readonly EmailId[]
): Map<string, EmailContentString> => {
	const index = new Map<string, EmailContentString>();
	ids.forEach((id) =>
		emailProtectedStrings(content[id], id).forEach((entry) => {
			const key = emailFingerprint(entry.value);
			if (!index.has(key)) index.set(key, entry);
		})
	);
	return index;
};

/** What `translationManifest.json` records for one occasion. */
export interface EmailTranslationRecord {
	source: string;
	target: string;
}

export interface EmailTranslationLocaleEntry {
	provenance: EmailTranslationProvenance;
	release: EmailLocaleRelease;
	occasions: Record<string, EmailTranslationRecord>;
}

export interface EmailTranslationManifest {
	source: EmailLocale;
	locales: Record<string, EmailTranslationLocaleEntry>;
}

/**
 * One signature in `translationReview.json`.
 *
 * Keyed by the fingerprint of the *translated* string, so editing the sentence
 * voids the signature rather than silently inheriting it.
 */
export interface EmailReviewSignature {
	/** The string as signed, so the ledger is readable without tooling. */
	text: string;
	/** Who read it. A person, in a language they actually speak. */
	reviewer: string;
	/** ISO date. */
	reviewedAt: string;
	note?: string;
}

export interface EmailTranslationReview {
	/** Locale → fingerprint of the translated string → who signed it off. */
	locales: Record<string, Record<string, EmailReviewSignature>>;
}

export interface EmailReviewGaps {
	/** Protected strings nobody has read yet. */
	unsigned: EmailContentString[];
	/** Signatures whose string has since been edited, voiding the sign-off. */
	orphaned: EmailReviewSignature[];
}

/**
 * What still stands between a machine-translated locale and being send-ready.
 *
 * Both halves matter. `unsigned` is the obvious one. `orphaned` is the one that
 * would otherwise rot quietly: someone tweaks a signed sentence, the signature
 * stays in the file, and the ledger keeps claiming a person vouched for wording
 * they never saw.
 */
export const emailReviewGaps = (
	content: Record<EmailId, EmailContent>,
	ids: readonly EmailId[],
	signatures: Record<string, EmailReviewSignature>
): EmailReviewGaps => {
	const index = emailProtectedStringIndex(content, ids);
	return {
		unsigned: [...index.entries()]
			.filter(([fingerprint]) => !signatures[fingerprint])
			.map(([, entry]) => entry),
		orphaned: Object.entries(signatures)
			.filter(([fingerprint]) => !index.has(fingerprint))
			.map(([, signature]) => signature)
	};
};
