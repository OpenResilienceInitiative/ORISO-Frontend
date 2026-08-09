import { describe, expect, it } from 'vitest';
import {
	ERSTANTWORT_CATALOGUE,
	ERSTANTWORT_TRIGGERS,
	UNTOGGLEABLE_BAUSTEIN_IDS,
	bausteinById,
	catalogueForTrigger
} from './erstantwortCatalogue';

const GENDERED_NOTATIONS = [/\*in\b/i, /_innen/i, /:innen/i, /\*innen/i];

describe('ERSTANTWORT_CATALOGUE — structure', () => {
	it('has unique ids', () => {
		const ids = ERSTANTWORT_CATALOGUE.map((entry) => entry.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('assigns every Baustein exactly one platform-owned trigger (ADR-018 §5)', () => {
		ERSTANTWORT_CATALOGUE.forEach((entry) => {
			expect(ERSTANTWORT_TRIGGERS).toContain(entry.trigger);
		});
	});

	it('gives every Baustein a source of Plattform-Text, Träger-Text or derived', () => {
		ERSTANTWORT_CATALOGUE.forEach((entry) => {
			expect(['PLATFORM', 'AGENCY', 'DERIVED']).toContain(entry.source);
		});
	});

	it('never makes a derived Baustein editable (ADR-018 §2 guardrail)', () => {
		ERSTANTWORT_CATALOGUE.filter(
			(entry) => entry.source === 'DERIVED'
		).forEach((entry) => {
			expect(entry.editable).toBe(false);
		});
	});

	it('contains exactly one free Baustein (ADR-018 §2)', () => {
		expect(
			ERSTANTWORT_CATALOGUE.filter((entry) => entry.isFree)
		).toHaveLength(1);
	});

	it('leaves the two safety-bearing Bausteine untoggleable (ADR-018 §6)', () => {
		UNTOGGLEABLE_BAUSTEIN_IDS.forEach((id) => {
			expect(bausteinById(id)?.toggleable).toBe(false);
		});
		expect([...UNTOGGLEABLE_BAUSTEIN_IDS].sort()).toEqual([
			'emergencyNumbers',
			'noPersonalData'
		]);
	});

	it('assigns at least one modality to every Baustein', () => {
		ERSTANTWORT_CATALOGUE.forEach((entry) => {
			expect(entry.modalities.length).toBeGreaterThan(0);
		});
	});
});

describe('ERSTANTWORT_CATALOGUE — platform voice (ADR-018 §7)', () => {
	it('carries no gendered notation in any default wording or i18n key', () => {
		ERSTANTWORT_CATALOGUE.forEach((entry) => {
			const strings = [
				entry.id,
				entry.bodyKey,
				entry.defaultBody,
				entry.headlineKey ?? '',
				entry.defaultHeadline ?? '',
				entry.action?.labelKey ?? '',
				entry.action?.defaultLabel ?? ''
			];
			strings.forEach((value) => {
				GENDERED_NOTATIONS.forEach((pattern) => {
					expect(value).not.toMatch(pattern);
				});
			});
		});
	});

	it('never says "Berater" in any inflection in the platform default wording', () => {
		ERSTANTWORT_CATALOGUE.forEach((entry) => {
			expect(entry.defaultBody).not.toMatch(/Berater/i);
			expect(entry.defaultHeadline ?? '').not.toMatch(/Berater/i);
		});
	});
});

describe('catalogueForTrigger', () => {
	it('returns the after-first-message Bausteine in catalogue order', () => {
		const ids = catalogueForTrigger('AFTER_FIRST_MESSAGE', {
			conversationType: 'AGENCY_COUNSELLING'
		}).map((entry) => entry.id);

		expect(ids).toContain('greeting');
		expect(ids).toContain('responseDeadline');
		expect(ids).toContain('noPersonalData');
		expect(ids).toContain('emergencyNumbers');
		// The free notice sits at a fixed position, before the closing.
		expect(ids.indexOf('freeNotice')).toBeLessThan(ids.indexOf('closing'));
		// Consent-bearing safety Bausteine precede the optional actions.
		expect(ids.indexOf('noPersonalData')).toBeLessThan(
			ids.indexOf('emailNotification')
		);
	});

	it('drops team and handover Bausteine in Live Chat (ADR-018 modality assignment)', () => {
		const liveChat = catalogueForTrigger('AFTER_FIRST_MESSAGE', {
			conversationType: 'LIVE_CHAT'
		}).map((entry) => entry.id);

		expect(liveChat).not.toContain('whoReadsAlong');
		// The safety Bausteine apply everywhere, including Live Chat.
		expect(liveChat).toContain('noPersonalData');
		expect(liveChat).toContain('emergencyNumbers');
	});

	it('offers credential saving in Agency Counselling and Self-Help, never in Live Chat', () => {
		const idsFor = (conversationType) =>
			catalogueForTrigger('AFTER_ENQUIRY_DISPATCHED', {
				conversationType
			}).map((entry) => entry.id);

		expect(idsFor('AGENCY_COUNSELLING')).toContain('saveCredentials');
		expect(idsFor('SELF_HELP')).toContain('saveCredentials');
		expect(idsFor('LIVE_CHAT')).not.toContain('saveCredentials');
	});

	it('returns nothing for a trigger with no Bausteine in that modality', () => {
		expect(
			catalogueForTrigger('AFTER_ENQUIRY_DISPATCHED', {
				conversationType: 'LIVE_CHAT'
			})
		).toEqual([]);
	});
});
