import { beforeAll, describe, expect, it } from 'vitest';
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

const i18n = createInstance();
beforeAll(async () => {
	await i18n.init({
		lng: 'de',
		fallbackLng: { 'de@informal': ['de'], 'default': ['de'] },
		resources: {
			'de': { translation: de },
			'de@informal': { translation: deInformal }
		}
	});
});

// Payload shapes as ORISO-UserService CaseHandoverService emits them today
// (buildCaseHandoverOfferParams / buildCaseHandoverParams), plus accessType.
const render = (
	eventType: string,
	payload: Record<string, unknown>,
	lng = 'de'
) =>
	renderEventStrings(
		getEventDescriptor(eventType),
		(key, options) => String(i18n.t(key, { ...options, lng })),
		{
			interpolation: toInterpolationValues(
				parseEventActionParams(
					JSON.stringify({ sessionId: 37, ...payload })
				)
			)
		}
	);
const offer = (payload: Record<string, unknown> = {}, lng?: string) =>
	render(
		'case.handover.offer.received',
		{ initiatorName: 'Lisa Simpson', caseHandoverRequestId: 7, ...payload },
		lng
	);
const granted = (payload: Record<string, unknown> = {}) =>
	render('case.handover.granted', {
		requesterName: 'Bart Simpson',
		reasonCode: 'ADVICE_NEEDED',
		reasonLabel: 'Fachliche Beratung',
		...payload
	});

describe('handover timeline entries show real names (#1714)', () => {
	it('names the offering counsellor instead of "a colleague"', () => {
		expect(offer().text).toBe(
			'Lisa Simpson möchte diese Beratung an Sie übergeben. Prüfen Sie die Anfrage, bevor Sie das Gespräch öffnen.'
		);
	});

	it('falls back to a neutral colleague, never a raw placeholder', () => {
		const { text } = offer({ initiatorName: undefined });
		expect(text).toMatch(/^Eine Kolleg:in möchte/);
		expect(text).not.toContain('{{');
	});

	it('uses the informal copy for de@informal', () => {
		expect(offer({}, 'de@informal').text).toBe(
			'Lisa Simpson möchte diese Beratung an dich übergeben. Prüfe die Anfrage, bevor du das Gespräch öffnest.'
		);
	});
});

describe('handover wording follows the server accessType only (#1714)', () => {
	it('words a CO_ACCESS offer as temporary access, not a handover', () => {
		const { title, text } = offer({ accessType: 'CO_ACCESS' });
		expect(title).toBe('Angebot für vorübergehenden Zugriff');
		expect(text).toContain('Lisa Simpson');
		expect(text).toContain('vorübergehenden Zugriff');
		expect(text).not.toContain('übergeben');
	});

	it('keeps takeover wording for an offer without accessType (backend offers are TAKEOVER only)', () => {
		expect(offer().title).toBe('Angebot zur Fallübergabe');
	});

	it('does not claim a takeover for a grant without accessType', () => {
		const { title, text } = granted();
		expect(title).toBe('Zugriff auf den Fall freigegeben');
		expect(`${title} ${text}`).not.toMatch(/übernommen|vorübergehend|\{\{/);
	});

	it('does not infer access semantics from the reason label', () => {
		expect(granted({ reasonCode: 'TAKEOVER' }).title).toBe(
			granted({ reasonCode: 'ADVICE_NEEDED' }).title
		);
	});

	it('words a CO_ACCESS grant as temporary read access', () => {
		const { title, text } = granted({ accessType: 'CO_ACCESS' });
		expect(title).toBe('Vorübergehender Zugriff freigegeben');
		expect(text).not.toContain('übernommen');
	});

	it('keeps the takeover wording only for an explicit TAKEOVER grant', () => {
		expect(granted({ accessType: 'TAKEOVER' }).title).toBe(
			'Neue Beratungsperson hat den Fall übernommen'
		);
	});

	it('ignores an unknown accessType value', () => {
		expect(granted({ accessType: 'OWNER' }).title).toBe(
			'Zugriff auf den Fall freigegeben'
		);
	});
});

describe('handover variants exist in every locale (#1714)', () => {
	const locales = { de, en, fr, ru, ti, tr } as Record<string, any>;
	const placeholders = (value: string) =>
		(value.match(/\{\{\w+\}\}/g) || []).sort();
	it.each(Object.keys(locales))('%s', (lng) => {
		const events = locales[lng].notifications.events;
		const offerKey = events.caseHandoverOfferReceived;
		const grantKey = events.caseHandoverGranted;
		for (const entry of [
			offerKey,
			offerKey.coAccess,
			grantKey,
			grantKey.coAccess,
			grantKey.generic
		]) {
			expect(entry.title).toBeTruthy();
			expect(entry.text).toBeTruthy();
		}
		expect(placeholders(offerKey.text)).toEqual(['{{fromConsultantName}}']);
		expect(placeholders(offerKey.coAccess.text)).toEqual([
			'{{fromConsultantName}}'
		]);
		expect(locales[lng].caseHandover.history.unknownColleague).toBeTruthy();
	});
});
