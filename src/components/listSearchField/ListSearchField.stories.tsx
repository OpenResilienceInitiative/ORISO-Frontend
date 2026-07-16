import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ListSearchField } from './ListSearchField';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';

const meta = {
	title: 'Molecules/ListSearchField',
	component: ListSearchField,
	tags: ['autodocs'],
	parameters: {
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'Shared pill-shaped search field used on top of master lists (Activity Timeline, conversation list). Controlled component — filter semantics live with the caller; list filters (family chips, unread) compose on top of the query.'
			}
		}
	}
} satisfies Meta<typeof ListSearchField>;

export default meta;
type Story = StoryObj<typeof meta>;

const ControlledField = (args: {
	placeholder: string;
	clearLabel: string;
	initialValue?: string;
}) => {
	const [value, setValue] = useState(args.initialValue ?? '');
	return (
		<div style={{ maxWidth: 400, padding: 16 }}>
			<ListSearchField
				value={value}
				onChange={setValue}
				placeholder={args.placeholder}
				clearLabel={args.clearLabel}
			/>
		</div>
	);
};

export const Empty: Story = {
	args: {
		value: '',
		onChange: () => {},
		placeholder: 'Aktivität durchsuchen…',
		clearLabel: 'Suche zurücksetzen'
	},
	render: (args) => <ControlledField {...args} />
};

export const WithQuery: Story = {
	args: Empty.args,
	render: (args) => <ControlledField {...args} initialValue="Entwurf" />
};
