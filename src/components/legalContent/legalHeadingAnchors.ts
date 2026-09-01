/**
 * Chapter anchors for a rendered legal text.
 *
 * The Admin panel derives its chapter navigation inside TipTap
 * (`FormPluginEditor/headingAnchors.ts`), because there the document is being
 * edited and every heading has to keep a stable, author-visible id. A reader
 * has no editor and no document model: it has already-sanitized HTML in the
 * DOM. So the anchors are stamped on the rendered nodes instead.
 *
 * That is not a shortcut, it is forced: `legalHtmlSanitizer` allows `class` and
 * nothing else on a generic tag, so an `id` written into the stored HTML is
 * stripped on the way in — deliberately, because ids in authored HTML are a
 * collision surface. Stamping after sanitising keeps the allowlist closed and
 * still gives every published legal text, including texts published years
 * before the feature existed, a working chapter row.
 *
 * The slug vocabulary is deliberately the same as the Admin's
 * `slugifyAnchorId`, so a chapter has the same id on both surfaces and an
 * in-text `#cross-reference` written in the Admin resolves in the frontend.
 */

export interface LegalHeadingAnchor {
	/** The heading's DOM id — also the chip's key. */
	id: string;
	/** Plain heading text, used as the chip label. */
	text: string;
	/** Heading level (1–6). */
	level: number;
}

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

/** Readable slug for a heading, e.g. "1. Geltungsbereich" → "1-geltungsbereich". */
export const slugifyAnchorId = (text: string): string => {
	const slug = text
		.toLowerCase()
		.replace(/ß/g, 'ss')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48)
		.replace(/-+$/g, '');
	return slug || 'section';
};

/** Longest chapter label a chip shows before it is cut (owner call 2026-07-30). */
export const ANCHOR_CHIP_LABEL_MAX = 33;

/**
 * Cuts on a word boundary where there is one in the last third, so a chapter
 * reads as "§ 4 Technische und organisatorische …" rather than breaking
 * mid-word. The ellipsis counts against the budget — a chip never exceeds 33
 * characters.
 */
export const truncateAnchorChipLabel = (text: string): string => {
	if (text.length <= ANCHOR_CHIP_LABEL_MAX) {
		return text;
	}
	const hard = text.slice(0, ANCHOR_CHIP_LABEL_MAX - 1).trimEnd();
	const lastSpace = hard.lastIndexOf(' ');
	const cut =
		lastSpace > ANCHOR_CHIP_LABEL_MAX - 12
			? hard.slice(0, lastSpace)
			: hard;
	return `${cut}…`;
};

/**
 * Stamps ids onto the headings inside `root` and returns them in document
 * order. Ids that survived sanitising are kept, so a cross-reference an author
 * wrote by hand still resolves; duplicates are suffixed the way the Admin
 * suffixes them.
 *
 * A heading with no text is skipped — an empty chip is a signpost to nothing.
 */
export const stampHeadingAnchors = (
	root: HTMLElement | null
): LegalHeadingAnchor[] => {
	if (!root) {
		return [];
	}

	// Every id already in the fragment is taken, not only the headings' own: a
	// stored text can carry an id on an ordinary element that an in-text
	// `#cross-reference` points at, and slugging a later heading onto the same
	// id would send the chip to that paragraph instead.
	const used = new Set(
		Array.from(
			root.querySelectorAll<HTMLElement>('[id]'),
			({ id }) => id
		).filter(Boolean)
	);

	return Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR))
		.map((heading) => {
			const text = heading.textContent?.trim() ?? '';
			if (!text) {
				return null;
			}

			let id = heading.getAttribute('id') ?? '';
			if (!id) {
				const base = slugifyAnchorId(text);
				id = base;
				let counter = 2;
				while (used.has(id)) {
					id = `${base}-${counter}`;
					counter += 1;
				}
				heading.setAttribute('id', id);
			}
			used.add(id);

			// The chip moves keyboard focus to the heading it jumps to, and a
			// heading is not focusable on its own.
			if (!heading.hasAttribute('tabindex')) {
				heading.setAttribute('tabindex', '-1');
			}

			return {
				id,
				text,
				level: Number(heading.tagName.slice(1)) || 2
			};
		})
		.filter((anchor): anchor is LegalHeadingAnchor => anchor !== null);
};
