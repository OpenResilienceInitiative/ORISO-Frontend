// @vitest-environment jsdom
import React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroupChatCalendarMenu } from './GroupChatCalendarMenu';

const translations: Record<string, string> = {
	'groupChat.calendar.add': 'Add to calendar',
	'groupChat.calendar.defaultTitle': 'Online appointment',
	'groupChat.calendar.download': 'Download ICS',
	'groupChat.calendar.google': 'Google Calendar',
	'groupChat.calendar.outlook': 'Outlook Calendar',
	'groupChat.calendar.titleLabel': 'Neutral calendar title'
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => translations[key] ?? key
	})
}));

describe('GroupChatCalendarMenu', () => {
	afterEach(cleanup);

	it('opens translated, confidentiality-neutral calendar actions', async () => {
		render(
			<GroupChatCalendarMenu
				start={new Date('2026-08-04T18:00:00Z')}
				durationMinutes={60}
				eventId={42}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', { name: 'Add to calendar' })
		);

		const titleInput = await screen.findByRole('textbox', {
			name: 'Neutral calendar title'
		});
		expect((titleInput as HTMLInputElement).value).toBe(
			'Online appointment'
		);
		expect(screen.getByText('Download ICS')).toBeTruthy();
		const googleLink = screen.getByRole('menuitem', {
			name: 'Google Calendar'
		});
		expect(googleLink.getAttribute('href')).toContain(
			'calendar.google.com'
		);
		expect(googleLink.getAttribute('href')).not.toMatch(
			/oriso|support|sucht/i
		);

		const parentKeyDown = vi.fn();
		document.addEventListener('keydown', parentKeyDown);
		fireEvent.keyDown(titleInput, { key: 'o' });
		expect(parentKeyDown).not.toHaveBeenCalled();
		document.removeEventListener('keydown', parentKeyDown);

		fireEvent.click(googleLink);
		await waitFor(() =>
			expect(screen.queryByText('Download ICS')).toBeNull()
		);
	});

	it('wires trigger state and lets Escape close the title editor', async () => {
		render(
			<GroupChatCalendarMenu
				start={new Date('2026-08-04T18:00:00Z')}
				durationMinutes={60}
				eventId={42}
			/>
		);
		const trigger = screen.getByRole('button', { name: 'Add to calendar' });
		expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');

		fireEvent.click(trigger);
		const titleInput = await screen.findByRole('textbox', {
			name: 'Neutral calendar title'
		});
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		expect(trigger.getAttribute('aria-controls')).toContain(
			'group-chat-calendar-menu'
		);

		fireEvent.keyDown(titleInput, { key: 'Escape' });
		await waitFor(() =>
			expect(screen.queryByText('Download ICS')).toBeNull()
		);
	});
});
