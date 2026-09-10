import { describe, expect, it } from 'vitest';
import {
	EntryRoomConsentInput,
	resolveEntryRoomConsent
} from './entryRoomConsent';

const LINKS =
	'<a href="/dsgvo">Datenschutz</a>, <a href="/impressum">Impressum</a>';
const PLATFORM = `Ich stimme zu. ${LINKS}`;
const MISSING_POLICY = `Keine Erklärung hinterlegt. Eigenes Risiko. ${LINKS}`;

const resolve = (overrides: Partial<EntryRoomConsentInput> = {}) =>
	resolveEntryRoomConsent({
		hasDepartment: true,
		department: { status: 'idle' },
		platformHtml: PLATFORM,
		missingPolicyHtml: MISSING_POLICY,
		legalLinksHtml: LINKS,
		locale: 'de',
		...overrides
	});

describe('resolveEntryRoomConsent', () => {
	it('shows the department wording when it has one', () => {
		const consent = resolve({
			department: {
				status: 'ok',
				sentence: 'Ich stimme der Verarbeitung zu. {{legal_links}}',
				versionId: 42
			}
		});

		expect(consent.html).toBe(`Ich stimme der Verarbeitung zu. ${LINKS}`);
		expect(consent.readable).toBe(true);
	});

	it('pins the agreement to the wording that was on screen', () => {
		// Without the version the acceptance is version-blind: a Träger publishing new
		// wording would not invalidate it, which is what ADR-021 gave the texts a history for.
		expect(
			resolve({
				department: {
					status: 'ok',
					sentence: 'Wortlaut. {{legal_links}}',
					versionId: 42
				}
			}).versionId
		).toBe(42);
	});

	it('shows the non-blocking risk warning when the department has no wording of its own', () => {
		const consent = resolve({
			department: { status: 'ok', sentence: null, versionId: null }
		});

		expect(consent.html).toBe(MISSING_POLICY);
		expect(consent.versionId).toBeNull();
		expect(consent.readable).toBe(true);
	});

	it('shows the same non-blocking risk warning when the department wording cannot be read', () => {
		const consent = resolve({ department: { status: 'unavailable' } });

		expect(consent.html).toBe(MISSING_POLICY);
		expect(consent.readable).toBe(true);
		expect(consent.versionId).toBeNull();
	});

	it('does not hold anything back when no department is known at all', () => {
		// An enquiry with no agency bound, or a backend that predates the coordinate.
		// The platform sentence has always applied here, so the flow is unchanged.
		const consent = resolve({
			hasDepartment: false,
			department: { status: 'unavailable' }
		});

		expect(consent.readable).toBe(true);
		expect(consent.html).toBe(PLATFORM);
	});

	it('appends the links to a sentence that lost its token', () => {
		// The token is mandatory at publication time and validated server-side, but a
		// consent sentence silently losing its link to the policy it consents to would be
		// the worst failure here, so the client does not rely on that validator having run.
		const consent = resolve({
			department: { status: 'ok', sentence: 'Ohne Token.', versionId: 7 }
		});

		expect(consent.html).toContain(LINKS);
	});
});
