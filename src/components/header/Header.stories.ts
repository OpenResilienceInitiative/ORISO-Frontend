import { Meta, StoryObj } from '@storybook/react';
import { Header } from './Header';

const meta = {
	title: 'Organisms/Header',
	component: Header,
	tags: ['autodocs', 'needs-data'],
	parameters: {
		// Figma: the full consultant session view (App.Oriso); the Header bar is the
		// top of this frame. Replace with a Header-only node link for a tighter match.
		design: {
			type: 'figma',
			url: 'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=316-17725'
		},
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
