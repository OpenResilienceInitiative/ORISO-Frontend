// @vitest-environment oriso-jsdom
/**
 * Test findings C1/C6: a deleted advice seeker's conversation, or one that
 * belongs to another counsellor, is not offered for a new appointment.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CalendarPage } from './CalendarPage';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));
if (typeof window.ResizeObserver === 'undefined')
	window.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
if (!HTMLElement.prototype.scrollTo)
	HTMLElement.prototype.scrollTo = () => undefined;
afterEach(cleanup);

describe('CalendarPage — only bookable conversations are offered (C1, C6)', () => {
	it('leaves deleted or foreign conversations out of the quick entry', () => {
		render(
			<CalendarPage
				role="consultant"
				ownerId="me"
				now={new Date(2026, 10, 16, 9, 50)}
				entries={[]}
				initialView="week"
				onCreate={() => Promise.resolve()}
				conversations={[
					{ sessionId: 1, username: 'eigene_eule' },
					{
						sessionId: 2,
						username: 'geloeschter_yak',
						bookable: false
					}
				]}
			/>
		);
		const input = document.querySelector<HTMLInputElement>(
			'[data-cy="calendar-quick-input"]'
		) as HTMLInputElement;
		fireEvent.change(input, { target: { value: 'morgen 14 Uhr Video' } });
		expect(screen.queryByText('eigene_eule')).not.toBeNull();
		expect(screen.queryByText('geloeschter_yak')).toBeNull();
	});
});
