import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { UserDataContext } from '../../globalState';
import { AbsenceFormular } from './AbsenceFormular';
import './profile.styles';

/**
 * ORISO-Frontend#2303: "Meine Abwesenheit" in the profile with optional
 * "von" and "bis". Without a date the absence lasts until switched off, as
 * before; after "bis" the counsellor is present again automatically.
 */
type Args = {
	absent: boolean;
	absenceStart?: string;
	absenceEnd?: string;
	absenceMessage?: string;
};

const Stage = (args: Args) => (
	<UserDataContext.Provider
		value={
			{
				userData: { agencies: [], ...args },
				setUserData: () => undefined,
				reloadUserData: async () => ({ agencies: [], ...args })
			} as never
		}
	>
		<div style={{ maxWidth: 560, padding: 24 }}>
			<AbsenceFormular />
		</div>
	</UserDataContext.Provider>
);

const meta: Meta<typeof Stage> = {
	title: 'Components/Profile/Meine Abwesenheit',
	component: Stage,
	globals: { locale: 'de' },
	parameters: {
		docs: {
			description: {
				component:
					'The absence switch with message and the optional planned range (ORISO-Frontend#2303). The same absence can be set from the calendar ("Neuer Eintrag" → "Abwesenheit").'
			}
		}
	},
	args: { absent: false, absenceMessage: '' }
};
export default meta;
type Story = StoryObj<typeof meta>;

/** Off, no dates: the hint explains "until further notice". */
export const Aus: Story = {
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(/bis auf Weiteres/)
		).toBeTruthy();
	}
};

/** Planned for later: switched on, not absent yet. */
export const Geplant: Story = {
	args: {
		absenceStart: '2026-12-21',
		absenceEnd: '2027-01-03',
		absenceMessage: 'Ich bin im Urlaub und ab dem 4. Januar wieder da.'
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole('switch')).toBeChecked();
		await expect(canvas.getByText(/Geplant ab/)).toBeTruthy();
	}
};

/** Absent now, until a last day. */
export const AbwesendBis: Story = {
	args: {
		absent: true,
		absenceEnd: '2027-01-03',
		absenceMessage: 'Ich bin im Urlaub und ab dem 4. Januar wieder da.'
	},
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(/Abwesend bis einschließlich/)
		).toBeTruthy();
	}
};

/** Absent until switched off: the old behaviour stays. */
export const BisAufWeiteres: Story = {
	args: {
		absent: true,
		absenceMessage: 'Ich bin bis auf Weiteres nicht erreichbar.'
	}
};
