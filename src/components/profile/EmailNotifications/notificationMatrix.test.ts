import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	ADVICE_SEEKER_SWITCHES,
	ALWAYS_SENT_KEYS,
	CONSULTANT_SWITCHES,
	NotificationSwitch,
	switchForOccasion
} from './notificationMatrix';

const german = JSON.parse(
	readFileSync('src/resources/i18n/de/common.json', 'utf8')
);

const translation = (key: string): unknown =>
	key.split('.').reduce<any>((node, part) => node?.[part], german);

describe('notification matrix (ADR-019)', () => {
	it('gives advice seekers a much shorter list than counsellors', () => {
		// The point of the ADR: not one list filtered by role. If these ever
		// converge, someone has merged them back together.
		expect(ADVICE_SEEKER_SWITCHES).toHaveLength(3);
		expect(CONSULTANT_SWITCHES.length).toBeGreaterThan(
			ADVICE_SEEKER_SWITCHES.length
		);
	});

	it('never shows an advice seeker a counsellor-only occasion', () => {
		const askerOccasions = ADVICE_SEEKER_SWITCHES.flatMap(
			(entry) => entry.occasions
		);
		for (const operational of [
			'neue-anfrage',
			'direkte-anfrage',
			'tagesuebersicht',
			'anfrage-zugewiesen',
			'uebergabe-angefragt',
			'uebergabe-bestaetigt',
			'rueckmeldung'
		]) {
			expect(askerOccasions).not.toContain(operational);
		}
	});

	it('offers no switch for an occasion nobody may switch off', () => {
		// Security and legal occasions from ADR-019. A switch here would be a
		// promise the platform cannot keep.
		const all = [...ADVICE_SEEKER_SWITCHES, ...CONSULTANT_SWITCHES].flatMap(
			(entry) => entry.occasions
		);
		for (const fixed of [
			'passwort-zuruecksetzen',
			'anmeldelink',
			'einmalcode',
			'email-geaendert',
			'einladung-traeger',
			'einladung-fachkraft',
			'avv-unterschrift'
		]) {
			expect(all).not.toContain(fixed);
		}
	});

	describe.each([
		['advice seeker', ADVICE_SEEKER_SWITCHES],
		['counsellor', CONSULTANT_SWITCHES]
	])('%s list', (_role, switches: NotificationSwitch[]) => {
		it('has unique ids', () => {
			const ids = switches.map((entry) => entry.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		it('covers each occasion exactly once', () => {
			const occasions = switches.flatMap((entry) => entry.occasions);
			expect(new Set(occasions).size).toBe(occasions.length);
		});

		it('has German copy for every title and description', () => {
			for (const entry of switches) {
				expect(translation(entry.titleKey), entry.titleKey).toBeTypeOf(
					'string'
				);
				expect(
					translation(entry.descriptionKey),
					entry.descriptionKey
				).toBeTypeOf('string');
			}
		});
	});

	it('has German copy for the always-sent note', () => {
		expect(
			translation('profile.notifications.matrix.alwaysSent.title')
		).toBeTypeOf('string');
		for (const key of ALWAYS_SENT_KEYS) {
			expect(translation(key), key).toBeTypeOf('string');
		}
	});

	describe('unsubscribe deep link', () => {
		it('resolves the occasion a mail footer carries', () => {
			expect(
				switchForOccasion(CONSULTANT_SWITCHES, 'uebergabe-bestaetigt')
					?.id
			).toBe('reassignment');
			expect(
				switchForOccasion(ADVICE_SEEKER_SWITCHES, 'termin')?.id
			).toBe('appointment');
		});

		it('resolves the same occasion to each role’s own switch', () => {
			// `neue-nachricht` reaches both roles, and each has its own switch
			// in its own storage.
			expect(
				switchForOccasion(ADVICE_SEEKER_SWITCHES, 'neue-nachricht')
					?.source
			).toEqual({
				kind: 'settings',
				field: 'newChatMessageNotificationEnabled'
			});
			expect(
				switchForOccasion(CONSULTANT_SWITCHES, 'neue-nachricht')?.source
			).toEqual({
				kind: 'emailToggle',
				type: 'NEW_CHAT_MESSAGE_FROM_ADVICE_SEEKER'
			});
		});

		it('resolves nothing for an unknown or absent occasion', () => {
			expect(
				switchForOccasion(CONSULTANT_SWITCHES, null)
			).toBeUndefined();
			expect(
				switchForOccasion(CONSULTANT_SWITCHES, 'anmeldelink')
			).toBeUndefined();
		});
	});
});
