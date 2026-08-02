import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ReactComponent as CalendarIcon } from '../../resources/img/icons/calendar.svg';
import { ReactComponent as PersonsIcon } from '../../resources/img/icons/persons.svg';
import { SplitButton } from './SplitButton';

/**
 * The shared M3 split button. Ported from the Admin panel atom so both apps
 * render the same control; the create-conversation cards and the
 * Gesprächskreis settings rows are built on it.
 */

const meta = {
	title: 'Atoms/SplitButton',
	component: SplitButton,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component:
					'Main action segment plus a trailing chevron (menu) or a down/up pair (stepper). Variants: outlined (resting), tonal (chosen value), elevated (this row owns an open menu), primary (ready to fire).'
			}
		}
	}
} satisfies Meta<typeof SplitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => undefined;

export const Outlined: Story = {
	args: {
		label: 'Thema / Fachbereich',
		icon: <CalendarIcon />,
		onClick: noop,
		onToggleMenu: noop,
		menuLabel: 'Liste öffnen'
	}
};

export const Tonal: Story = {
	args: { ...Outlined.args, label: '23. August 2026', variant: 'tonal' }
};

export const Elevated: Story = {
	args: {
		...Outlined.args,
		label: '19:00',
		variant: 'elevated',
		open: true
	}
};

export const Primary: Story = {
	args: {
		...Outlined.args,
		label: '2 Personen hinzugefügt',
		icon: <PersonsIcon />,
		variant: 'primary'
	}
};

export const Disabled: Story = {
	args: { ...Outlined.args, disabled: true }
};

export const MainDisabled: Story = {
	args: { ...Outlined.args, mainDisabled: true }
};

export const Stepper: Story = {
	args: {
		label: '4 h',
		icon: <CalendarIcon />,
		variant: 'tonal',
		onClick: noop,
		onDecrement: noop,
		onIncrement: noop,
		decrementLabel: 'Dauer verringern',
		incrementLabel: 'Dauer erhöhen'
	}
};

const InteractiveDemo = () => {
	const [open, setOpen] = useState(false);
	const [chosen, setChosen] = useState(false);
	return (
		<div style={{ width: 360 }}>
			<SplitButton
				fullWidth
				icon={<CalendarIcon />}
				label={chosen ? '23. August 2026' : 'Datum wählen'}
				variant={open ? 'elevated' : chosen ? 'tonal' : 'outlined'}
				open={open}
				onClick={() => setChosen((prev) => !prev)}
				onToggleMenu={() => setOpen((prev) => !prev)}
				menuLabel="Datumsliste öffnen oder schließen"
			/>
		</div>
	);
};

export const FullWidthRow: Story = {
	args: { label: '', onClick: noop },
	render: () => <InteractiveDemo />
};
