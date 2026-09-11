import { describe, expect, it } from 'vitest';
import { resolveErstantwortBausteine } from './erstantwortResolve';
import {
	ERSTANTWORT_PAYLOAD_VERSION,
	SYSTEM_NOTIFICATION_FIRST_RESPONSE
} from './erstantwortPayload';
import { SYSTEM_NOTIFICATION_PREFIX } from '../message/messageConstants';

/** Minimal `t` stand-in: returns the defaultValue, so the catalogue fallback wins. */
const translate = (_key: string, defaultValue?: string) => defaultValue ?? '';

const event = (bausteine: unknown[]) =>
	`${SYSTEM_NOTIFICATION_PREFIX}${JSON.stringify({
		type: SYSTEM_NOTIFICATION_FIRST_RESPONSE,
		version: ERSTANTWORT_PAYLOAD_VERSION,
		bausteine
	})}`;

const baseState = {
	hasEmail: false,
	isTwoFactorEnabled: true,
	isTwoFactorActive: false
};

describe('resolveErstantwortBausteine — from a persisted event', () => {
	it('renders the frozen wording from the event, not the catalogue default', () => {
		const resolved = resolveErstantwortBausteine({
			rawMessage: event([
				{ id: 'greeting', body: 'Hallo von Ihrer Beratungsstelle.' }
			]),
			translate,
			state: baseState
		});

		expect(resolved.status).toBe('ok');
		expect(resolved.bausteine[0].body).toBe(
			'Hallo von Ihrer Beratungsstelle.'
		);
	});

	it('keeps the event order even when it differs from the catalogue', () => {
		const resolved = resolveErstantwortBausteine({
			rawMessage: event([
				{ id: 'closing', body: 'Bis bald.' },
				{ id: 'greeting', body: 'Hallo.' }
			]),
			translate,
			state: baseState
		});

		expect(resolved.bausteine.map((b) => b.id)).toEqual([
			'closing',
			'greeting'
		]);
	});

	it('renders a Baustein whose id the catalogue does not know', () => {
		// A newer server may ship a Baustein this frontend predates. Its wording
		// is frozen in the event, so it is renderable regardless.
		const resolved = resolveErstantwortBausteine({
			rawMessage: event([{ id: 'brandNewThing', body: 'Etwas Neues.' }]),
			translate,
			state: baseState
		});

		expect(resolved.bausteine.map((b) => b.id)).toEqual(['brandNewThing']);
	});

	it('renders nothing at all for an unsupported payload version', () => {
		const resolved = resolveErstantwortBausteine({
			rawMessage: `${SYSTEM_NOTIFICATION_PREFIX}${JSON.stringify({
				type: SYSTEM_NOTIFICATION_FIRST_RESPONSE,
				version: 99,
				bausteine: [{ id: 'greeting', body: 'Hallo.' }]
			})}`,
			translate,
			state: baseState
		});

		expect(resolved.status).toBe('unsupported-version');
		expect(resolved.bausteine).toEqual([]);
	});
});

describe('resolveErstantwortBausteine — live action state (ADR-018 §4)', () => {
	const withEmailAction = () =>
		event([
			{
				id: 'emailNotification',
				body: 'Sie können eine E-Mail hinterlegen.',
				action: { kind: 'ADD_EMAIL', label: 'E-Mail angeben' }
			}
		]);

	it('shows the button while the state is unsatisfied', () => {
		const resolved = resolveErstantwortBausteine({
			rawMessage: withEmailAction(),
			translate,
			state: baseState
		});

		expect(resolved.bausteine[0].action?.kind).toBe('ADD_EMAIL');
	});

	it('drops the button once the person already has an e-mail address', () => {
		const resolved = resolveErstantwortBausteine({
			rawMessage: withEmailAction(),
			translate,
			state: { ...baseState, hasEmail: true }
		});

		// The Baustein still renders — the wording is part of the record —
		// but the call to action is gone.
		expect(resolved.bausteine).toHaveLength(1);
		expect(resolved.bausteine[0].action).toBeUndefined();
	});

	it('drops the 2FA button when two-factor auth is already active', () => {
		const twoFactorEvent = event([
			{
				id: 'accountProtection',
				body: 'Schützen Sie Ihren Zugang.',
				action: { kind: 'ENABLE_2FA', label: 'Zugang schützen' }
			}
		]);

		expect(
			resolveErstantwortBausteine({
				rawMessage: twoFactorEvent,
				translate,
				state: { ...baseState, isTwoFactorActive: true }
			}).bausteine[0].action
		).toBeUndefined();
	});

	it('drops the 2FA button when the tenant has not enabled two-factor auth at all', () => {
		const twoFactorEvent = event([
			{
				id: 'accountProtection',
				body: 'Schützen Sie Ihren Zugang.',
				action: { kind: 'ENABLE_2FA', label: 'Zugang schützen' }
			}
		]);

		expect(
			resolveErstantwortBausteine({
				rawMessage: twoFactorEvent,
				translate,
				state: { ...baseState, isTwoFactorEnabled: false }
			}).bausteine[0].action
		).toBeUndefined();
	});

	it('silences the e-mail Baustein entirely when the Träger switched e-mail off', () => {
		// ORISO-Admin#602 switch 2: off must silence the Baustein, not just its
		// button — otherwise the chat still invites an e-mail in prose.
		const resolved = resolveErstantwortBausteine({
			rawMessage: withEmailAction(),
			translate,
			state: { ...baseState, isAskerEmailEnabled: false }
		});

		expect(resolved.bausteine).toEqual([]);
	});

	it('drops a SAVE_CREDENTIALS action carried by an already-persisted event', () => {
		/* The catalogue no longer emits it, but v1 events already in rooms may,
		   and the wire format still accepts the kind — so removing it from the
		   catalogue alone protects nothing. Its affordance is the inline
		   SaveCredentialsCard; a button here would render enabled and do nothing. */
		const resolved = resolveErstantwortBausteine({
			rawMessage: event([
				{
					id: 'saveCredentials',
					body: 'Sichern Sie sich Ihren Zugang.',
					action: {
						kind: 'SAVE_CREDENTIALS',
						label: 'Zugangsdaten sichern'
					}
				}
			]),
			translate,
			state: baseState
		});

		expect(resolved.bausteine).toHaveLength(1);
		expect(resolved.bausteine[0].action).toBeUndefined();
		expect(resolved.bausteine[0].body).toBe(
			'Sichern Sie sich Ihren Zugang.'
		);
	});
});

describe('resolveErstantwortBausteine — client-side triggers (no event)', () => {
	it('falls back to the platform catalogue for a trigger the server does not emit', () => {
		const resolved = resolveErstantwortBausteine({
			trigger: 'AFTER_ENQUIRY_DISPATCHED',
			context: { conversationType: 'AGENCY_COUNSELLING' },
			translate,
			state: baseState
		});

		expect(resolved.status).toBe('ok');
		expect(resolved.bausteine.map((b) => b.id)).toEqual([
			'enquiryReceived',
			'notificationChoice',
			'deviceLimit',
			'saveCredentials',
			'displayName'
		]);
		expect(
			resolved.bausteine.find((b) => b.id === 'saveCredentials')?.body
		).toContain('Anmeldenamen');
	});

	it('reassures before it limits — the counselling survives a lost device', () => {
		const { bausteine } = resolveErstantwortBausteine({
			trigger: 'AFTER_ENQUIRY_DISPATCHED',
			context: { conversationType: 'AGENCY_COUNSELLING' },
			translate,
			state: baseState
		});

		const deviceLimit = bausteine.find((b) => b.id === 'deviceLimit');

		// "Beratung geht weiter" has to come before "Ersatzschlüssel", or the
		// message reads as "everything you wrote is about to be lost".
		expect(
			deviceLimit?.body.indexOf('geht die Beratung ganz normal weiter')
		).toBeLessThan(deviceLimit?.body.indexOf('Ersatzschlüssel') ?? -1);
		expect(deviceLimit?.action?.kind).toBe('SHOW_RECOVERY_KEY');
	});

	it('respects the modality assignment — Live Chat gets no post-dispatch Bausteine', () => {
		expect(
			resolveErstantwortBausteine({
				trigger: 'AFTER_ENQUIRY_DISPATCHED',
				context: { conversationType: 'LIVE_CHAT' },
				translate,
				state: baseState
			}).bausteine
		).toEqual([]);
	});

	it('drops a catalogue Baustein whose default wording is empty (the unfilled free notice)', () => {
		const ids = resolveErstantwortBausteine({
			trigger: 'AFTER_FIRST_MESSAGE',
			context: { conversationType: 'AGENCY_COUNSELLING' },
			translate,
			state: baseState
		}).bausteine.map((b) => b.id);

		expect(ids).not.toContain('freeNotice');
		expect(ids).toContain('greeting');
	});

	it('substitutes the response deadline number into the derived wording', () => {
		const deadline = resolveErstantwortBausteine({
			trigger: 'AFTER_FIRST_MESSAGE',
			context: {
				conversationType: 'AGENCY_COUNSELLING',
				deadlineDays: 5
			},
			translate,
			state: baseState
		}).bausteine.find((b) => b.id === 'responseDeadline');

		expect(deadline?.body).toContain('5 Werktagen');
		expect(deadline?.body).not.toContain('{{');
	});

	it('uses the platform default of 2 Werktage when no deadline is configured', () => {
		const deadline = resolveErstantwortBausteine({
			trigger: 'AFTER_FIRST_MESSAGE',
			context: { conversationType: 'AGENCY_COUNSELLING' },
			translate,
			state: baseState
		}).bausteine.find((b) => b.id === 'responseDeadline');

		expect(deadline?.body).toContain('2 Werktagen');
	});

	it('returns nothing when neither an event nor a trigger is given', () => {
		expect(
			resolveErstantwortBausteine({ translate, state: baseState })
				.bausteine
		).toEqual([]);
	});
});
