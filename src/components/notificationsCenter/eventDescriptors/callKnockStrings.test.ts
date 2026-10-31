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
	resolveNotificationActionPath,
	toInterpolationValues
} from '../notificationActionTarget';
import { getEventDescriptor, isKnownEventType } from './registry';
import { renderEventStrings } from './renderEventStrings';

/**
 * FE#1952: a person opened the counsellor's video direct link and knocked —
 * the counsellor got nothing. ORISO-UserService now writes a
 * `call.knock.requested` entry for the counsellor of the conversation; these
 * tests pin how the bell renders it and where it leads.
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

// The payload as EventNotificationService.createCallKnockRequestedNotification
// emits it.
const payload = (medium?: string) =>
	JSON.stringify({
		conversationType: 'AGENCY_COUNSELLING',
		sessionId: 500,
		roomRef: '!direct:matrix.example',
		...(medium ? { medium } : {})
	});

const render = (medium?: string, lng = 'de') =>
	renderEventStrings(
		getEventDescriptor('call.knock.requested'),
		(key, options) => String(i18n.t(key, { ...options, lng })),
		{
			fallbackTitle: 'Someone is knocking',
			fallbackText: 'Someone wants to join your call.',
			interpolation: toInterpolationValues(
				parseEventActionParams(payload(medium))
			)
		}
	);

describe('knock on a direct-link call (FE#1952)', () => {
	it('is a known event of the calls family, so it rings with the call tone', () => {
		expect(isKnownEventType('call.knock.requested')).toBe(true);
		const descriptor = getEventDescriptor('call.knock.requested');
		expect(descriptor.family).toBe('calls');
		expect(descriptor.category).toBe('system');
	});

	it('keeps the medium from the params and nothing that names the person', () => {
		expect(parseEventActionParams(payload('VIDEO')).medium).toBe('VIDEO');
		expect(parseEventActionParams(payload('AUDIO')).medium).toBe('AUDIO');
		expect(parseEventActionParams(payload('FAX')).medium).toBeUndefined();
	});

	it('names the video call', () => {
		expect(render('VIDEO')).toEqual({
			title: 'Jemand klopft an – Videoanruf',
			text: 'Eine Person möchte über Ihren Direktlink in Ihren Videoanruf. Treten Sie dem Anruf bei, um sie einzulassen.'
		});
	});

	it('names the audio call', () => {
		expect(render('AUDIO').title).toBe('Jemand klopft an – Audioanruf');
		expect(render('AUDIO').text).toContain('Audioanruf');
	});

	it('still reads as a knock when the medium is missing', () => {
		expect(render()).toEqual({
			title: 'Jemand klopft an',
			text: 'Eine Person möchte in Ihren Anruf. Treten Sie dem Anruf bei, um sie einzulassen.'
		});
	});

	it('speaks informally for de@informal', () => {
		expect(render('VIDEO', 'de@informal').text).toBe(
			'Eine Person möchte über deinen Direktlink in deinen Videoanruf. Tritt dem Anruf bei, um sie einzulassen.'
		);
	});

	it.each(['en', 'fr', 'ru', 'ti', 'tr'])(
		'has its own %s wording for every medium',
		(lng) => {
			for (const medium of [undefined, 'VIDEO', 'AUDIO']) {
				const { title, text } = render(medium, lng);
				expect(title).not.toBe(render(medium, 'de').title);
				expect(text).not.toBe(render(medium, 'de').text);
				expect(`${title} ${text}`).not.toMatch(/\{\{|notifications\./);
			}
		}
	);

	it('goes straight into the call of the conversation the person knocks in', () => {
		const target = getEventDescriptor(
			'call.knock.requested'
		).resolveActionTarget({
			...parseEventActionParams(payload('VIDEO')),
			actionPath:
				'/sessions/consultant/sessionView/!direct:matrix.example/500'
		});
		expect(target).toEqual({
			kind: 'callRoom',
			roomId: '!direct:matrix.example',
			isVideo: true,
			path: '/sessions/consultant/sessionView/!direct:matrix.example/500'
		});
		expect(
			getEventDescriptor('call.knock.requested').resolveActionTarget(
				parseEventActionParams(payload('AUDIO'))
			)
		).toMatchObject({ kind: 'callRoom', isVideo: false });
	});

	it('still opens the conversation when the call cannot start from the entry', () => {
		expect(
			resolveNotificationActionPath(
				{
					eventType: 'call.knock.requested',
					actionPath:
						'/sessions/consultant/sessionView/!direct:matrix.example/500',
					params: parseEventActionParams(payload('VIDEO'))
				},
				'/sessions/consultant/sessionView',
				'/sessions/consultant/sessionPreview'
			)
		).toBe('/sessions/consultant/sessionView/!direct:matrix.example/500');
		expect(
			getEventDescriptor('call.knock.requested').resolveActionTarget({})
		).toEqual({
			kind: 'callRoom',
			roomId: null,
			isVideo: false,
			path: null
		});
	});
});
