import type { LegalLinkKind } from './useLegalLinkContent';

/**
 * The short platform-level note behind a legal link on a public page.
 *
 * Stage and stage layout are pre-login surfaces: nobody has chosen a
 * Beratungsstelle yet, so no carrier's legal text applies there. Showing one
 * would answer a question the visitor has not asked and attribute the
 * disclosure to an organisation they have no relationship with. The note names
 * the platform instead, and keeps the full binding document one click away.
 *
 * Session views are the opposite case — an agency is known — and keep opening
 * the tenant-authored text through `LegalLinkModal` directly.
 */
export const platformLegalNoteKey = (kind: LegalLinkKind): string =>
	kind === 'privacy'
		? 'login.legal.platform.dataprotection'
		: 'login.legal.platform.impressum';

export const PLATFORM_LEGAL_FULL_TEXT_KEY = 'login.legal.platform.fullText';
