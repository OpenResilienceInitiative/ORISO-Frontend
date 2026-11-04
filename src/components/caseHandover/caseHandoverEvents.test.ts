import { describe, expect, it } from 'vite-plus/test';
import { CASE_HANDOVER_RESOLUTION_EVENTS } from './caseHandoverEvents';

describe('events that end a handover offer', () => {
	it.each([
		'case.handover.granted',
		'case.handover.consent.declined',
		// the recipient said no / the offering counsellor took the offer back:
		// both screens must refresh live instead of waiting for a focus event
		'case.handover.offer.declined',
		'case.handover.offer.withdrawn'
	])('%s ends an offer', (type) => {
		expect(CASE_HANDOVER_RESOLUTION_EVENTS.has(type)).toBe(true);
	});

	it('does not treat "offer sent" or "offer received" as an ending', () => {
		expect(
			CASE_HANDOVER_RESOLUTION_EVENTS.has('case.handover.offer.sent')
		).toBe(false);
		expect(
			CASE_HANDOVER_RESOLUTION_EVENTS.has('case.handover.offer.received')
		).toBe(false);
	});
});
