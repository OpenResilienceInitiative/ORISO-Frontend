import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { NewEntryDialog } from './NewEntryDialog';
import { AutoAcceptDialog } from './AutoAcceptDialog';
import {
	COLLEAGUES,
	CONVERSATIONS,
	ME,
	OWN_ENTRIES,
	STORY_NOW
} from './calendarStoryData';
import './calendar.styles.scss';

/**
 * "Neuer Eintrag" → Termin: with an advice seeker or with a colleague
 * (FE#2305, Frank 2026-11-17: "Was ist, wenn ich einfach mit einem Kollegen
 * sprechen will?"). With a colleague, the appointment goes into the private
 * internal chat of the two; every kind is offered.
 */
const meta: Meta<typeof NewEntryDialog> = {
	title: 'Templates/Calendar/Neuer Eintrag',
	component: NewEntryDialog,
	globals: { locale: 'de' },
	parameters: { layout: 'fullscreen' },
	args: {
		open: true,
		initialTab: 'appointment',
		conversations: CONVERSATIONS,
		colleagues: COLLEAGUES,
		entries: OWN_ENTRIES,
		ownerId: ME,
		now: STORY_NOW,
		onSaveAppointment: fn(),
		onSaveBlocker: fn(),
		onClose: fn()
	}
};
export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

/** As before: a counselling conversation is chosen. */
export const WithAdviceSeeker: Story = {};

/** "Kolleg:in" chosen: the colleague list replaces "Beratung". */
export const WithColleague: Story = {
	play: async ({ args }) => {
		await userEvent.click(
			await body().findByRole('radio', { name: 'Kolleg:in' })
		);
		await expect(
			body().queryByRole('combobox', { name: 'Beratung' })
		).toBeNull();
		await userEvent.click(
			await body().findByRole('combobox', { name: 'Kolleg:in' })
		);
		await userEvent.click(
			await body().findByRole('option', {
				name: new RegExp(COLLEAGUES[0].displayName)
			})
		);
		await userEvent.click(
			await body().findByRole('button', { name: 'Vor Ort' })
		);
		await userEvent.click(
			await body().findByTestId('calendar-appointment-save')
		);
		await waitFor(() =>
			expect(args.onSaveAppointment).toHaveBeenCalledWith(
				expect.objectContaining({
					colleagueId: COLLEAGUES[0].id,
					kind: 'onsite'
				})
			)
		);
	}
};

/** Saving without a colleague asks for one. */
export const WithColleagueMissing: Story = {
	play: async ({ args }) => {
		await userEvent.click(
			await body().findByRole('radio', { name: 'Kolleg:in' })
		);
		await userEvent.click(
			await body().findByTestId('calendar-appointment-save')
		);
		await expect(await body().findByRole('alert')).toHaveTextContent(
			'Bitte eine Kollegin oder einen Kollegen wählen.'
		);
		await expect(args.onSaveAppointment).not.toHaveBeenCalled();
	}
};

/**
 * A colleague the Träger allows no internal chat with: only "Vor Ort"
 * (Frank, 2026-11-17).
 */
export const WithColleagueOnSiteOnly: Story = {
	args: {
		colleagues: [
			{ ...COLLEAGUES[0], internalChat: false },
			...COLLEAGUES.slice(1)
		]
	},
	play: async ({ args }) => {
		await userEvent.click(
			await body().findByRole('radio', { name: 'Kolleg:in' })
		);
		await userEvent.click(
			await body().findByRole('combobox', { name: 'Kolleg:in' })
		);
		await userEvent.click(
			await body().findByRole('option', {
				name: new RegExp(COLLEAGUES[0].displayName)
			})
		);
		await expect(
			body().queryByRole('button', { name: 'Video' })
		).toBeNull();
		await expect(
			await body().findByText(/Möglich ist nur ein Termin vor Ort/)
		).toBeTruthy();
		await userEvent.click(
			await body().findByTestId('calendar-appointment-save')
		);
		await waitFor(() =>
			expect(args.onSaveAppointment).toHaveBeenCalledWith(
				expect.objectContaining({ kind: 'onsite' })
			)
		);
	}
};

const AutoAcceptStory = () => {
	const [selected, setSelected] = useState<string[]>([COLLEAGUES[1].id]);
	return (
		<AutoAcceptDialog
			open
			colleagues={COLLEAGUES}
			selected={selected}
			onSave={setSelected}
			onClose={() => undefined}
		/>
	);
};

/** More menu → "Termine automatisch annehmen …": the colleague multi-select. */
export const AutoAccept: StoryObj = {
	render: () => <AutoAcceptStory />,
	play: async () => {
		await expect(
			await body().findByTestId('calendar-auto-accept-dialog')
		).toBeTruthy();
		await expect(
			body().getByText(
				'Termine von allen anderen warten, bis Sie sie annehmen.'
			)
		).toBeTruthy();
	}
};
