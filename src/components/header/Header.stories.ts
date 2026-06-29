import { Meta, StoryObj } from '@storybook/react';
import { Header } from './Header';

const meta = {
	title: 'Organisms/Header',
	component: Header,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'App header showing the localized title, UI version toggle, and either the agency logo or the tenant claim text.'
			}
		}
	}
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
