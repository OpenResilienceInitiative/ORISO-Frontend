// @vitest-environment oriso-jsdom
/**
 * One invitation flow, three doors: "Chat erstellen" (Direkteinladung), the
 * 1:1's "Termin anlegen" and the calendar's "Neuer Eintrag" show the same
 * form. These tests pin what makes them the same: section order, what a
 * door already knows is not asked again, and one value shape.
 */
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import * as React from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import {
	InvitationDialog,
	type InvitationDialogProps
} from './InvitationDialog';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: number }) =>
			options?.count !== undefined ? `${key}:${options.count}` : key,
		i18n: { language: 'de' }
	})
}));

type PickerProps = {
	label: string;
	value: Dayjs | null;
	onChange?: (value: Dayjs | null) => void;
};
vi.mock('../form/OrisoDatePicker', () => ({
	OrisoDatePicker: ({ label, value, onChange }: PickerProps) => (
		<input
			aria-label={label}
			value={value ? value.format('YYYY-MM-DD') : ''}
			onChange={(e) =>
				onChange?.(e.target.value ? dayjs(e.target.value) : null)
			}
		/>
	)
}));
vi.mock('../form/OrisoTimePicker', () => ({
	OrisoTimePicker: ({ label, value, onChange }: PickerProps) => (
		<input
			aria-label={label}
			value={value ? value.format('HH:mm') : ''}
			onChange={(e) =>
				onChange?.(
					e.target.value ? dayjs(e.target.value, 'HH:mm') : null
				)
			}
		/>
	)
}));
vi.mock('../form/OrisoCalendar', () => ({
	OrisoCalendar: () => <div data-testid="month" />
}));
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

dayjs.extend(customParseFormat);

const SLOT = 'sessionList.timeline.appointment.dialog';
const KEYS = 'directInvitation.dialog';
const NOW = new Date(2026, 10, 3, 12, 0);
const START = new Date(2026, 10, 5, 14, 0);
const END = new Date(2026, 10, 5, 15, 0);

const sections = () =>
	Array.from(document.querySelectorAll<HTMLElement>('[data-section]')).map(
		(el) => el.dataset.section
	);
const click = async (name: string) => {
	await act(async () => {
		fireEvent.click(screen.getByRole('button', { name }));
	});
};
const conversation = () =>
	screen.getByLabelText('calendar.dialog.conversation') as HTMLSelectElement;

describe('one invitation form behind three doors', () => {
	const onSubmit = vi.fn();
	const onClose = vi.fn();
	const open = (props: Partial<InvitationDialogProps>) =>
		render(
			<InvitationDialog
				variant="appointment"
				onSubmit={onSubmit}
				onClose={onClose}
				now={NOW}
				{...props}
			/>
		);

	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(cleanup);

	it('shows the sections in one order: Beratung, Termin, Art, more people, link', () => {
		open({
			conversations: {
				options: [{ sessionId: 7, label: 'mutige_eule' }]
			},
			withKind: true,
			allowGuestInvite: true,
			initial: { inviteOthers: true }
		});
		expect(sections()).toEqual([
			'conversation',
			'slot',
			'kind',
			'invite',
			'link'
		]);
	});

	it('the 1:1 door shows the same sections without the conversation it already is', () => {
		open({
			withKind: true,
			allowGuestInvite: true,
			initial: { inviteOthers: true }
		});
		expect(sections()).toEqual(['slot', 'kind', 'invite', 'link']);
	});

	it('does not ask again what the door knows: a calendar slot gives time and Art', async () => {
		open({
			conversations: {
				options: [{ sessionId: 7, label: 'mutige_eule' }],
				initial: 7
			},
			withKind: true,
			initial: { start: START, end: END, kind: 'phone' },
			known: { slot: true, kind: true }
		});
		expect(sections()).toEqual(['conversation']);
		await click(`${SLOT}.createAction`);
		expect(onSubmit).toHaveBeenCalledWith({
			appointment: { start: START, end: END },
			link: null,
			kind: 'phone',
			sessionId: 7
		});
	});

	it('asks for the conversation before saving', async () => {
		open({
			conversations: {
				options: [{ sessionId: 7, label: 'mutige_eule' }]
			},
			initial: { start: START, end: END },
			known: { slot: true }
		});
		await click(`${SLOT}.createAction`);
		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole('alert').textContent).toBe(
			'calendar.dialog.error.conversation'
		);
	});

	it('hands a new person over to the Direkteinladung with the slot and Art', async () => {
		const onInviteNewPerson = vi.fn();
		open({
			conversations: {
				options: [{ sessionId: 7, label: 'mutige_eule' }],
				onInviteNewPerson
			},
			withKind: true,
			allowGuestInvite: true,
			initial: { start: START, end: END, kind: 'onsite' },
			known: { slot: true, kind: true }
		});
		fireEvent.change(conversation(), { target: { value: 'new-person' } });
		// The Direkteinladung asks who may come in; the form does not.
		expect(sections()).toEqual(['conversation']);
		expect(screen.getByRole('status').textContent).toBe(
			`${KEYS}.newPerson.hint`
		);
		await click(`${KEYS}.newPerson.action`);
		expect(onInviteNewPerson).toHaveBeenCalledWith({
			start: START,
			end: END,
			kind: 'onsite'
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('refuses a new person for an Art whose medium is not allowed, instead of swapping the medium', async () => {
		const onInviteNewPerson = vi.fn();
		open({
			conversations: {
				options: [{ sessionId: 7, label: 'mutige_eule' }],
				onInviteNewPerson
			},
			withKind: true,
			allowGuestInvite: true,
			inviteMedia: ['CHAT'],
			initial: { start: START, end: END, kind: 'video' },
			known: { slot: true, kind: true }
		});
		fireEvent.change(conversation(), { target: { value: 'new-person' } });
		await click(`${KEYS}.newPerson.action`);
		expect(onInviteNewPerson).not.toHaveBeenCalled();
		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole('alert').textContent).toBe(
			`${KEYS}.inviteOthersMediumOff`
		);
	});

	it('offers no new person where the door cannot hand over', () => {
		open({
			conversations: { options: [{ sessionId: 7, label: 'mutige_eule' }] }
		});
		expect(Array.from(conversation().options).map((o) => o.value)).toEqual([
			'',
			'7'
		]);
	});

	it('names an overlap and says "save anyway" on the action', async () => {
		const conflicts = vi.fn(() => ({
			note: 'overlaps: Pause',
			actionLabel: 'calendar.dialog.saveAnyway'
		}));
		open({
			initial: { start: START, end: END },
			known: { slot: true },
			conflicts
		});
		expect(conflicts).toHaveBeenCalledWith({ start: START, end: END });
		expect(screen.getByRole('status').textContent).toBe('overlaps: Pause');
		await click('calendar.dialog.saveAnyway');
		expect(onSubmit).toHaveBeenCalled();
	});

	it('sends the Art with the link settings when more people are invited', async () => {
		open({
			withKind: true,
			allowGuestInvite: true,
			initial: { start: START, end: END, inviteOthers: true }
		});
		fireEvent.click(
			document.querySelector<HTMLElement>(
				'[data-cy="calendar-dialog-kind-chat"]'
			)!
		);
		await click(`${SLOT}.createAction`);
		expect(onSubmit).toHaveBeenCalledWith({
			appointment: { start: START, end: END },
			link: { validityMinutes: 1440, access: 'both', knock: true },
			kind: 'chat'
		});
	});

	describe('"Direkteinladung erlauben" per medium: the link follows the Art', () => {
		const inviteSwitch = () =>
			screen.getByRole('switch', { name: `${KEYS}.inviteOthers` });
		const pickKind = (kind: string) =>
			fireEvent.click(
				document.querySelector<HTMLElement>(
					`[data-cy="calendar-dialog-kind-${kind}"]`
				)!
			);

		it('says why there is no link for an Art whose medium is not allowed', async () => {
			// Chat links allowed, video links not; the Art defaults to Video.
			open({
				withKind: true,
				allowGuestInvite: true,
				inviteMedia: ['CHAT'],
				initial: { start: START, end: END, inviteOthers: true }
			});
			expect((inviteSwitch() as HTMLInputElement).disabled).toBe(true);
			expect((inviteSwitch() as HTMLInputElement).checked).toBe(false);
			expect(
				screen.getByText(`${KEYS}.inviteOthersMediumOff`)
			).toBeTruthy();
			expect(sections()).not.toContain('link');

			// Only the appointment is saved: no link the backend would refuse.
			await click(`${SLOT}.createAction`);
			expect(onSubmit).toHaveBeenCalledWith({
				appointment: { start: START, end: END },
				link: null,
				kind: 'video'
			});
		});

		it('offers the link again for an Art whose medium is allowed', async () => {
			open({
				withKind: true,
				allowGuestInvite: true,
				inviteMedia: ['CHAT'],
				initial: { start: START, end: END, inviteOthers: true }
			});
			pickKind('chat');
			expect((inviteSwitch() as HTMLInputElement).disabled).toBe(false);
			expect(sections()).toContain('link');
			await click(`${SLOT}.createAction`);
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					link: expect.objectContaining({ access: 'both' }),
					kind: 'chat'
				})
			);
		});

		it('takes the Art a calendar slot already knows', () => {
			open({
				withKind: true,
				allowGuestInvite: true,
				inviteMedia: ['CHAT', 'AUDIO'],
				known: { slot: true, kind: true },
				initial: { start: START, end: END, kind: 'video' }
			});
			expect((inviteSwitch() as HTMLInputElement).disabled).toBe(true);
		});
	});

	it('shows the month next to the fields for the calendar\'s "+"', () => {
		open({ dateLayout: 'month' });
		expect(screen.getByTestId('month')).toBeTruthy();
		expect(screen.queryByLabelText(`${SLOT}.date`)).toBeNull();
		expect(screen.getByLabelText(`${SLOT}.start`)).toBeTruthy();
	});

	it('gives every door an icon above the title (Frank *1)', () => {
		open({});
		expect(document.querySelector('.m3Dialog__heroIcon svg')).toBeTruthy();
	});
});
