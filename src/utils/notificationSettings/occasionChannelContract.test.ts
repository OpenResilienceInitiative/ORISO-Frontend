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

	it('does not invent a browser producer for planned notices or appointments', () => {
		expect(
			occasionChannelContract('systemhinweis', 'asker')?.browser
		).toEqual({
			kind: 'unmapped'
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
});
