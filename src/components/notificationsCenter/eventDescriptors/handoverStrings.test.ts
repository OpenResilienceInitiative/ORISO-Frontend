import { beforeAll, describe, expect, it } from 'vitest';
import { createInstance } from 'i18next';
import de from '../../../resources/i18n/de/common.json';
import {
	parseEventActionParams,
	toInterpolationValues
} from '../notificationActionTarget';
import { getEventDescriptor } from './registry';
import { renderEventStrings } from './renderEventStrings';

const i18n = createInstance();
beforeAll(async () => {
	await i18n.init({ lng: 'de', resources: { de: { translation: de } } });
});
const render = (accessType?: string, eventType = 'case.handover.offered') =>
	renderEventStrings(
		getEventDescriptor(eventType),
		(key, options) => String(i18n.t(key, options)),
		{
			interpolation: toInterpolationValues(
				parseEventActionParams(
					JSON.stringify({
						sessionId: 37,
						fromConsultantName: 'Lisa Simpson',
						toConsultantName: 'Bart Simpson',
						reasonCode: 'ADVICE_REQUESTED',
						offerId: 7,
						caseHandoverRequestId: 7,
						accessType
					})
				)
			)
		}
	);
describe('actual handover notification params → visible German strings', () => {
	it('keeps the producer names through parsing instead of rendering a literal placeholder', () => {
		expect(render('TAKEOVER').text).toBe(
			'Lisa Simpson möchte dir einen Fall übergeben. Du entscheidest, ob du ihn annimmst.'
		);
	});
	it('uses only the explicit server accessType for temporary-access wording', () => {
		expect(render('CO_ACCESS').text).toContain('Lisa Simpson');
		expect(render('CO_ACCESS').text).toContain('vorübergehenden Zugriff');
		expect(render('CO_ACCESS').text).not.toContain('übergeben');
		expect(render('TAKEOVER').title).toBe('Fall wird dir angeboten');
	});
	it('does not infer ownership or access from a legacy reason when accessType is absent', () => {
		expect(render().text).not.toMatch(
			/übergeben|vorübergehenden Zugriff|\{\{/
		);
	});
	it.each(['accepted', 'declined', 'expired'])(
		'keeps %s CO_ACCESS copy about the offer, not transferred ownership',
		(suffix) => {
			expect(
				render('CO_ACCESS', `case.handover.${suffix}`).text
			).not.toMatch(/Fall angenommen|Übergabe/);
		}
	);
});
