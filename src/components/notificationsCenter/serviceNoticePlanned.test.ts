import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';
import {
	getEventDescriptor,
	isKnownEventType
} from './eventDescriptors/registry';
import { renderEventStrings } from './eventDescriptors/renderEventStrings';
import {
	parseEventActionParams,
	resolveNotificationActionPath,
	resolveNotificationStatusPageUrl,
	toInterpolationValues
} from './notificationActionTarget';
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';
import fr from '../../resources/i18n/fr/common.json';
import ru from '../../resources/i18n/ru/common.json';
import ti from '../../resources/i18n/ti/common.json';
import tr from '../../resources/i18n/tr/common.json';
import deInformal from '../../resources/i18n/de@informal/common.json';

/**
 * Frontend#876: UserService (#1343) writes one feed row per counselling-centre
 * admin when a planned maintenance notice is confirmed. The row carries the
 * window as params; the server title/text are an English fallback that must
 * never reach a reader of another language.
 */
const EVENT_TYPE = 'service.notice.planned';
const SERVER_TITLE = 'Planned maintenance';
const SERVER_TEXT =
	'Planned maintenance on 2026-10-15 from 22:00 to 23:30. Current status: https://status.example.org/';
const PAYLOAD =
	'{"campaignKey":"maint-2026-10-15","maintenanceDate":"2026-10-15","maintenanceStart":"22:00","maintenanceEnd":"23:30","statusUrl":"https://status.example.org/"}';

const CATALOGUES = { de, en, fr, ru, ti, tr } as const;

const rendered = (language: string, raw: unknown = PAYLOAD) => {
	const i18n = createInstance();
	void i18n.init({
		lng: language,
		fallbackLng: 'de',
		initImmediate: false,
		resources: {
			...Object.fromEntries(
				Object.entries(CATALOGUES).map(([lng, translation]) => [
					lng,
					{ translation }
				])
			),
			'de@informal': { translation: deInformal }
		}
	});
	return renderEventStrings(
		getEventDescriptor(EVENT_TYPE),
		i18n.getFixedT(language),
		{
			fallbackTitle: SERVER_TITLE,
			fallbackText: SERVER_TEXT,
			interpolation: toInterpolationValues(
				parseEventActionParams(raw),
				language
			)
		}
	);
};

describe('planned service notice in the activity feed (#876)', () => {
	it('is a known system event, so the system switch governs its pop-up', () => {
		expect(isKnownEventType(EVENT_TYPE)).toBe(true);
		const descriptor = getEventDescriptor(EVENT_TYPE);
		expect(descriptor.family).toBe('system');
		expect(descriptor.category).toBe('system');
		expect(descriptor.titleTemplate).toBe(
			'notifications.events.serviceNoticePlanned.title'
		);
	});

	it('reads the window and the status link from the producer params', () => {
		expect(parseEventActionParams(PAYLOAD)).toMatchObject({
			maintenanceDate: '2026-10-15',
			maintenanceStart: '22:00',
			maintenanceEnd: '23:30',
			statusUrl: 'https://status.example.org/'
		});
	});

	it('drops malformed window values and any non-web status link', () => {
		const params = parseEventActionParams(
			JSON.stringify({
				maintenanceDate: '15.10.2026',
				maintenanceStart: '25:00',
				maintenanceEnd: '7:5',
				// A script URL must never reach an anchor href.
				statusUrl: ['javascript', 'alert(1)'].join(':')
			})
		);
		expect(params.maintenanceDate).toBeUndefined();
		expect(params.maintenanceStart).toBeUndefined();
		expect(params.maintenanceEnd).toBeUndefined();
		expect(params.statusUrl).toBeUndefined();
	});

	it('opens the status page, never an in-app route', () => {
		const item = {
			eventType: EVENT_TYPE,
			params: parseEventActionParams(PAYLOAD)
		};
		expect(resolveNotificationStatusPageUrl(item)).toBe(
			'https://status.example.org/'
		);
		expect(
			resolveNotificationActionPath(
				item,
				'/sessions/consultant/sessionView'
			)
		).toBeNull();
		expect(
			resolveNotificationStatusPageUrl({
				eventType: EVENT_TYPE,
				params: parseEventActionParams(
					'{"statusUrl":"data:text/html,hi"}'
				)
			})
		).toBeNull();
		expect(
			resolveNotificationStatusPageUrl({
				eventType: 'message.new',
				params: parseEventActionParams(PAYLOAD)
			})
		).toBeNull();
	});

	it('renders German from the catalogue with a German date', () => {
		expect(rendered('de')).toEqual({
			title: 'Geplante Wartung',
			text: 'Am 15. Oktober 2026 ist die Plattform zwischen 22:00 und 23:30 Uhr nicht erreichbar. Bereits geschriebene Nachrichten gehen nicht verloren.'
		});
	});

	it('renders English from the catalogue with an English date', () => {
		expect(rendered('en')).toEqual({
			title: 'Scheduled maintenance',
			text: 'On October 15, 2026, the platform will be unavailable between 22:00 and 23:30. Messages you have already written will not be lost.'
		});
	});

	it('uses the German wording for the informal German locale without crashing on its tag', () => {
		expect(rendered('de@informal')).toEqual(rendered('de'));
	});

	it.each(Object.keys(CATALOGUES))(
		'renders %s from its own catalogue, never the server English or a raw placeholder',
		(language) => {
			const { title, text } = rendered(language);
			expect(title).not.toBe('');
			expect(text).toContain('22:00');
			expect(text).toContain('23:30');
			expect(text).not.toContain('2026-10-15');
			expect(text).not.toContain('{{');
			expect(text).not.toContain(SERVER_TEXT);
			if (language !== 'en') {
				expect(title).not.toBe(SERVER_TITLE);
				expect(text).not.toContain('Messages you have already written');
			}
		}
	);

	it.each(Object.entries(CATALOGUES))(
		'offers a localised status-page action in %s',
		(_language, catalogue) => {
			const center = (catalogue as any).notifications.center;
			expect(typeof center.openStatusPage).toBe('string');
			expect(center.openStatusPage).not.toBe('');
			expect(typeof center.opensInNewTab).toBe('string');
			expect(center.opensInNewTab).not.toBe('');
		}
	);

	it('never leaves a raw placeholder when the producer sent no window', () => {
		const { text } = rendered('de', '{}');
		expect(text).not.toContain('{{');
	});
});
