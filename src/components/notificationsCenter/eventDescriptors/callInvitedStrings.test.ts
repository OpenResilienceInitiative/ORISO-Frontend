import { beforeAll, describe, expect, it } from 'vite-plus/test';
import { createInstance } from 'i18next';
import de from '../../../resources/i18n/de/common.json';
import deInformal from '../../../resources/i18n/de@informal/common.json';
import en from '../../../resources/i18n/en/common.json';
import fr from '../../../resources/i18n/fr/common.json';
import ru from '../../../resources/i18n/ru/common.json';
import ti from '../../../resources/i18n/ti/common.json';
import tr from '../../../resources/i18n/tr/common.json';
import {
	parseEventActionParams,
	toInterpolationValues
} from '../notificationActionTarget';
import { getEventDescriptor } from './registry';
import { renderEventStrings } from './renderEventStrings';

/**
 * FE#1211: a counsellor's video call to an advice seeker announced itself as
 * "Einladung zu internem Gruppenanruf". `call.invited` is written for every
 * call a person is invited to (EventNotificationService
 * .createCallInvitationNotification): a one-to-one counselling call carries a
 * `sessionId`, a group call a `seriesId`. Its wording must be true for both.
 */
const i18n = createInstance();
beforeAll(async () => {
	await i18n.init({
		lng: 'de',
		fallbackLng: { 'de@informal': ['de'], 'default': ['de'] },
		resources: {
			'de': { translation: de },
			'de@informal': { translation: deInformal },
			'en': { translation: en },
			'fr': { translation: fr },
			'ru': { translation: ru },
			'ti': { translation: ti },
			'tr': { translation: tr }
		}
	});
});

// The payload as the producer emits it for a one-to-one counselling call.
const sessionCall = JSON.stringify({
	roomRef: '!session:matrix.example',
	sessionId: 16,
	callId: 'call-1',
	callRoomId: '!media:matrix.example',
	callType: 'video',
	callerName: 'ling.bouvier'
});

const render = (lng = 'de') =>
	renderEventStrings(
		getEventDescriptor('call.invited'),
		(key, options) => String(i18n.t(key, { ...options, lng })),
		{
			fallbackTitle: 'Call invitation',
			fallbackText: 'You were invited to a call.',
			interpolation: toInterpolationValues(
				parseEventActionParams(sessionCall)
			)
		}
	);

describe('call invitation wording (FE#1211)', () => {
	it('does not call a counselling call an internal group call', () => {
		expect(render()).toEqual({
			title: 'Einladung zum Anruf',
			text: 'Sie wurden zu einem Anruf eingeladen.'
		});
	});

	it('speaks informally for de@informal', () => {
		expect(render('de@informal').text).toBe(
			'Du wurdest zu einem Anruf eingeladen.'
		);
	});

	it.each(['en', 'fr', 'ru', 'ti', 'tr'])(
		'names no internal group in %s either',
		(lng) => {
			const { title, text } = render(lng);
			expect(`${title} ${text}`).not.toMatch(
				/internal|interne|внутренн|dahili|ውሽጣዊ|\{\{|notifications\./i
			);
			expect(title).not.toBe(render('de').title);
		}
	);
});
