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
import userEvent from '@testing-library/user-event';
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
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

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
		const googleLink = screen.getByRole('link', {
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
		expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
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
	it.each([
		[
			'copyGoogle',
			'https://calendar.google.com/calendar/render?action=TEMPLATE&text=My+appointment&dates=20260804T180000Z%2F20260804T190000Z'
		],
		[
			'copyOutlook',
			'https://outlook.live.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=My+appointment&startdt=2026-08-04T18%3A00%3A00.000Z&enddt=2026-08-04T19%3A00%3A00.000Z'
		]
	])(
		'copies %s with the edited title and appointment times',
		async (action, expectedUrl) => {
			const writeText = vi.fn().mockResolvedValue(undefined);
			vi.stubGlobal('navigator', { clipboard: { writeText } });
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
			fireEvent.change(
				await screen.findByRole('textbox', {
					name: 'Neutral calendar title'
				}),
				{ target: { value: 'My appointment' } }
			);
			expect(
				screen.getByText('groupChat.calendar.shareHint')
			).toBeTruthy();
			fireEvent.click(
				screen.getByRole('button', {
					name: `groupChat.calendar.${action}`
				})
			);
			await waitFor(() =>
				expect(writeText).toHaveBeenCalledWith(expectedUrl)
			);
			expect(await screen.findByRole('status')).toHaveProperty(
				'textContent',
				'groupChat.calendar.linkCopied'
			);
			expect(screen.queryByRole('alert')).toBeNull();
		}
	);

	it('shows failure rather than success when clipboard permission is denied', async () => {
		vi.stubGlobal('navigator', {
			clipboard: {
				writeText: vi.fn().mockRejectedValue(new Error('Denied'))
			}
		});
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
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'groupChat.calendar.copyGoogle'
			})
		);
		expect(await screen.findByRole('alert')).toHaveProperty(
			'textContent',
			'groupChat.calendar.copyError'
		);
		expect(screen.queryByText('groupChat.calendar.linkCopied')).toBeNull();
	});
	it('keeps editable and descriptive content outside the action menu and restores focus', async () => {
		const user = userEvent.setup();
		render(
			<GroupChatCalendarMenu
				start={new Date('2026-08-04T18:00:00Z')}
				durationMinutes={60}
				eventId={42}
			/>
		);
		const trigger = screen.getByRole('button', { name: 'Add to calendar' });
		await user.click(trigger);
		const title = await screen.findByRole('textbox', {
			name: 'Neutral calendar title'
		});
		expect(title.closest('[role="menu"]')).toBeNull();
		expect(
			screen
				.getByText('groupChat.calendar.shareHint')
				.closest('[role="menu"]')
		).toBeNull();
		expect(screen.getAllByRole('link')).toHaveLength(2);
		expect(
			screen
				.getByRole('button', { name: 'groupChat.calendar.copyGoogle' })
				.closest('a')
		).toBeNull();
		await user.click(title);
		await user.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(document.activeElement).toBe(trigger);
	});
});
