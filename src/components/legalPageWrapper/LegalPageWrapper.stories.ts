import { Meta, StoryObj } from '@storybook/react';
import { LegalPageWrapper } from './LegalPageWrapper';

const meta = {
	title: 'Templates/LegalPageWrapper',
	component: LegalPageWrapper,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Wraps legal page HTML content in the standard stage layout, parsing the provided HTML string into the page body.'
			}
		}
	}
} satisfies Meta<typeof LegalPageWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		content:
			'<h2>Imprint</h2><p>This is the legal page content rendered from an HTML string.</p>'
	}
};

export const WithCustomClass: Story = {
	args: {
		className: 'customLegalPage',
		content:
			'<h2>Privacy Policy</h2><p>We respect your privacy.</p><ul><li>Data point one</li><li>Data point two</li></ul>'
	}
};
