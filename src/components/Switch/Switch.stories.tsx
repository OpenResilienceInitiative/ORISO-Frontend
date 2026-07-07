import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { useArgs } from 'storybook/preview-api';
import { Switch, SwitchProps } from './index';

const meta = {
	title: 'Components/Switch',
	component: Switch,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'M3 ORISO switch for binary settings. Matches the Design System M3 ORISO switch tokens and supports enabled, disabled, selected, unselected, focus, hover, pressed, and icon states.'
			}
		}
	},
	argTypes: {
		checked: {
			control: 'boolean'
		},
		disabled: {
			control: 'boolean'
		},
		showIcon: {
			control: 'boolean'
		}
	}
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

const InteractiveSwitch = (args: SwitchProps) => {
	const [{ checked }, updateArgs] = useArgs();

	return (
		<Switch
			{...args}
			checked={checked}
			onChange={(nextChecked, event) => {
				updateArgs({ checked: nextChecked });
				args.onChange?.(nextChecked, event);
			}}
		/>
	);
};

export const Checked: Story = {
	render: InteractiveSwitch,
	args: {
		'checked': true,
		'showIcon': true,
		'aria-label': 'Enable setting'
	}
};

export const Unchecked: Story = {
	render: InteractiveSwitch,
	args: {
		'checked': false,
		'showIcon': true,
		'aria-label': 'Disable setting'
	}
};

export const DisabledChecked: Story = {
	args: {
		'checked': true,
		'disabled': true,
		'showIcon': true,
		'aria-label': 'Disabled enabled setting',
		'onChange': () => {}
	}
};

export const DisabledUnchecked: Story = {
	args: {
		'checked': false,
		'disabled': true,
		'showIcon': true,
		'aria-label': 'Disabled setting',
		'onChange': () => {}
	}
};

export const WithoutIcon: Story = {
	render: InteractiveSwitch,
	args: {
		'checked': true,
		'showIcon': false,
		'aria-label': 'Enable setting without icon'
	}
};

export const WithLabelAndDescription: Story = {
	render: InteractiveSwitch,
	args: {
		checked: true,
		titleKey: 'profile.browserNotifications.newMessage.title',
		descriptionKey: 'profile.browserNotifications.newMessage.description',
		showIcon: true
	}
};
