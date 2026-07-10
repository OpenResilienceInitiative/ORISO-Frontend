// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
	it('opens translated, confidentiality-neutral calendar actions', async () => {
		render(
			<GroupChatCalendarMenu
				start={new Date('2026-08-04T18:00:00Z')}
				durationMinutes={60}
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
	});
});
