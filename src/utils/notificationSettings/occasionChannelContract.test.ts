import { describe, expect, it } from 'vitest';
import { EMAIL_IDS } from '../../emails/content/emailCatalogue';
import { isKnownEventType } from '../../components/notificationsCenter/eventDescriptors/registry';
import { occasionChannelContract } from './occasionChannelContract';

describe('occasion channel contract', () => {
	it('covers every mail occasion without assuming that a sender exists', () => {
		for (const id of EMAIL_IDS) {
			expect(
				occasionChannelContract(id).roles.length,
				id
			).toBeGreaterThan(0);
			for (const role of occasionChannelContract(id).roles) {
				const channels = occasionChannelContract(id, role);
				expect(
					channels?.emailPreference,
					`${id}/${role}`
				).toBeDefined();
				expect(channels?.browser, `${id}/${role}`).toBeDefined();
				if (channels?.browser.kind === 'descriptor') {
					for (const eventType of channels.browser.eventTypes) {
						expect(isKnownEventType(eventType), eventType).toBe(
							true
						);
					}
				}
			}
		}
	});

	it('maps asker consent mail to its real event and existing switch', () => {
		for (const id of [
			'einsicht-angefragt',
			'uebergabe-angefragt'
		] as const) {
			const contract = occasionChannelContract(id, 'asker');
			expect(contract?.emailPreference).toEqual({
				kind: 'switch',
				source: {
					kind: 'settings',
					field: 'reassignmentNotificationEnabled'
				}
			});
			expect(contract?.browser.kind).toBe('descriptor');
			if (contract?.browser.kind === 'descriptor')
				expect(contract.browser.eventTypes).toContain(
					'case.handover.consent.requested'
				);
		}
		expect(
			occasionChannelContract('uebergabe-bestaetigt', 'asker')
		).toBeUndefined();
	});

	it('keeps the two new-message recipients on their own email switches', () => {
		const asker = occasionChannelContract('neue-nachricht', 'asker');
		const consultant = occasionChannelContract(
			'neue-nachricht',
			'consultant'
		);
		expect(asker?.emailPreference).toEqual({
			kind: 'switch',
			source: {
				kind: 'settings',
				field: 'newChatMessageNotificationEnabled'
			}
		});
		expect(consultant?.emailPreference).toEqual({
			kind: 'switch',
			source: {
				kind: 'emailToggle',
				type: 'NEW_CHAT_MESSAGE_FROM_ADVICE_SEEKER'
			}
		});
		expect(asker?.browser).toEqual({
			kind: 'descriptor',
			eventTypes: ['message.new']
		});
	});

	it('keeps the consultant-specific message mail on the existing consultant channel', () => {
		expect(
			occasionChannelContract('neue-nachricht-beratung').roles
		).toEqual(['consultant']);
		expect(
			occasionChannelContract('neue-nachricht-beratung', 'consultant')
		).toEqual({
			emailPreference: {
				kind: 'switch',
				source: {
					kind: 'emailToggle',
					type: 'NEW_CHAT_MESSAGE_FROM_ADVICE_SEEKER'
				}
			},
			browser: { kind: 'descriptor', eventTypes: ['message.new'] }
		});
		expect(
			occasionChannelContract('neue-nachricht-beratung', 'asker')
		).toBeUndefined();
	});

	it('does not invent a browser producer for planned notices or appointments', () => {
		expect(
			occasionChannelContract('systemhinweis', 'asker')?.browser
		).toEqual({
			kind: 'unmapped'
		});
		expect(occasionChannelContract('systemhinweis').roles).toEqual([
			'asker',
			'consultant'
		]);
		expect(
			occasionChannelContract('systemhinweis', 'consultant')
				?.emailPreference
		).toEqual({
			kind: 'switch',
			source: {
				kind: 'settings',
				field: 'serviceNoticeNotificationEnabled'
			}
		});
		expect(occasionChannelContract('termin', 'asker')?.browser).toEqual({
			kind: 'unmapped'
		});
	});

	it('never treats security or legal mail as user-switchable', () => {
		for (const id of [
			'passwort-zuruecksetzen',
			'anmeldelink',
			'einmalcode',
			'avv-unterschrift'
		] as const) {
			for (const role of occasionChannelContract(id).roles) {
				expect(
					occasionChannelContract(id, role)?.emailPreference
				).toEqual({
					kind: 'no-switch'
				});
			}
		}
	});

	it('keeps self-help appointments role-specific without promising a browser notification', () => {
		for (const outcome of [
			'bestaetigt',
			'verschoben',
			'abgesagt',
			'erinnerung'
		] as const) {
			const participant =
				`selbsthilfe-termin-${outcome}-teilnahme` as const;
			const counsellor =
				`selbsthilfe-termin-${outcome}-beratung` as const;
			expect(occasionChannelContract(participant).roles).toEqual([
				'asker'
			]);
			expect(occasionChannelContract(counsellor).roles).toEqual([
				'consultant'
			]);
			expect(
				occasionChannelContract(participant, 'asker')?.browser
			).toEqual({ kind: 'unmapped' });
			expect(occasionChannelContract(counsellor, 'consultant')).toEqual({
				emailPreference: {
					kind: 'switch',
					source: {
						kind: 'settings',
						field: 'appointmentNotificationEnabled'
					}
				},
				browser: { kind: 'unmapped' }
			});
			expect(
				occasionChannelContract(participant, 'consultant')
			).toBeUndefined();
			expect(
				occasionChannelContract(counsellor, 'asker')
			).toBeUndefined();
		}
	});
});
