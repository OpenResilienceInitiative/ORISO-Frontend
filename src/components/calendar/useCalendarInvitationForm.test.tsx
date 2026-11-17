// @vitest-environment oriso-jsdom
/**
 * The calendar's "Termin" is the shared invitation form: it invites more
 * people by link as the 1:1 does, and hands someone without a conversation
 * to the Direkteinladung of "Chat erstellen".
 */
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { NewEntryDialog } from './NewEntryDialog';
import { draftFromInvitation } from './useCalendarInvitationForm';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));
vi.mock('../form/OrisoCalendar', () => ({ OrisoCalendar: () => null }));
vi.mock('../form/OrisoSelect', () => ({
	OrisoSelect: ({
		label,
		value,
		options,
		onChange
	}: {
		label: string;
		value: string;
		options: { value: string; label: string }[];
		onChange: (event: { target: { value: string } }) => void;
	}) => (
		<select
			aria-label={label}
			value={value}
			onChange={(e) => onChange({ target: { value: e.target.value } })}
		>
			<option value="" />
			{options.map((o) => (
				<option key={o.value} value={o.value}>
					{o.label}
				</option>
			))}
		</select>
	)
}));

afterEach(cleanup);

const NOW = new Date(2026, 10, 14, 12, 0);
const SLOT = {
	start: new Date(2026, 10, 16, 14),
	end: new Date(2026, 10, 16, 15)
};

const open = (
	props: Partial<React.ComponentProps<typeof NewEntryDialog>> = {}
) =>
	render(
		<NewEntryDialog
			open
			initialTab="appointment"
			conversations={[{ sessionId: 7, username: 'mutige_eule' }]}
			entries={[]}
			ownerId="me"
			now={NOW}
			onSaveAppointment={() => undefined}
			onSaveBlocker={() => undefined}
			onClose={() => undefined}
			{...props}
		/>
	);
const save = async () => {
	await act(async () => {
		fireEvent.click(screen.getByTestId('calendar-appointment-save'));
	});
};

describe('calendar "Termin" — the shared invitation form', () => {
	it('invites more people by link, as "Termin anlegen" in a 1:1', async () => {
		const onSaveAppointment = vi.fn();
		open({
			slot: { ...SLOT, kind: 'video' },
			initialSessionId: 7,
			allowGuestInvite: true,
			onSaveAppointment
		});
		fireEvent.click(
			screen.getByRole('switch', {
				name: 'directInvitation.dialog.inviteOthers'
			})
		);
		await save();
		expect(onSaveAppointment).toHaveBeenCalledWith({
			type: 'appointment',
			start: SLOT.start,
			end: SLOT.end,
			kind: 'video',
			sessionId: 7,
			link: { validityMinutes: 1440, access: 'both', knock: true }
		});
	});

	it('offers no link for an Art whose medium "Direkteinladung erlauben" does not allow', () => {
		open({
			slot: { ...SLOT, kind: 'video' },
			initialSessionId: 7,
			allowGuestInvite: true,
			inviteMedia: ['CHAT']
		});
		const invite = screen.getByRole('switch', {
			name: 'directInvitation.dialog.inviteOthers'
		}) as HTMLInputElement;
		expect(invite.disabled).toBe(true);
		expect(
			screen.getByText('directInvitation.dialog.inviteOthersMediumOff')
		).toBeTruthy();
	});

	it('offers no link where "Direkteinladung erlauben" does not allow it', () => {
		open({ slot: { ...SLOT, kind: 'video' } });
		expect(
			screen.queryByRole('switch', {
				name: 'directInvitation.dialog.inviteOthers'
			})
		).toBeNull();
	});

	it('hands a person without a conversation to the Direkteinladung with the slot', async () => {
		const onInviteNewPerson = vi.fn();
		const onSaveAppointment = vi.fn();
		open({
			slot: { ...SLOT, kind: 'phone' },
			onInviteNewPerson,
			onSaveAppointment
		});
		fireEvent.change(
			screen.getByLabelText('calendar.dialog.conversation'),
			{
				target: { value: 'new-person' }
			}
		);
		await save();
		expect(onInviteNewPerson).toHaveBeenCalledWith({
			start: SLOT.start,
			end: SLOT.end,
			kind: 'phone'
		});
		expect(onSaveAppointment).not.toHaveBeenCalled();
	});

	it('maps the form value to the calendar draft', () => {
		expect(
			draftFromInvitation({ appointment: null, link: null })
		).toBeUndefined();
		expect(
			draftFromInvitation({
				appointment: SLOT,
				link: null,
				kind: 'chat',
				sessionId: 3
			})
		).toEqual({
			type: 'appointment',
			start: SLOT.start,
			end: SLOT.end,
			kind: 'chat',
			sessionId: 3
		});
	});
});
