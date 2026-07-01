import { Meta, StoryObj } from '@storybook/react';
import { GenerateQrCode } from './GenerateQrCode';

const meta = {
	title: 'Molecules/GenerateQrCode',
	component: GenerateQrCode,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Renders a link that opens an overlay containing a downloadable QR code generated from the given URL.'
			}
		}
	}
} satisfies Meta<typeof GenerateQrCode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		url: 'https://oriso.org/registration',
		headline: 'Scan to register',
		filename: 'oriso-registration'
	}
};

export const WithText: Story = {
	args: {
		url: 'https://oriso.org/registration',
		headline: 'Scan to register',
		text: 'Point your phone camera at the QR code to open the registration page.',
		filename: 'oriso-registration'
	}
};
