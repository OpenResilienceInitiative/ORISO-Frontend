// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) =>
	readFileSync(resolve(process.cwd(), path), 'utf8');

describe('booking appointment actions', () => {
	it('does not retain controls that open or copy legacy appointment-call URLs', () => {
		const bookingEvent = readSource(
			'src/containers/bookings/components/Event/event.tsx'
		);
		const overviewEvent = readSource(
			'src/containers/overview/components/BookingEvent/index.tsx'
		);

		expect(bookingEvent).not.toContain('window.open');
		expect(bookingEvent).not.toContain('copyTextToClipboard');
		expect(overviewEvent).not.toContain('window.open');
	});
});
