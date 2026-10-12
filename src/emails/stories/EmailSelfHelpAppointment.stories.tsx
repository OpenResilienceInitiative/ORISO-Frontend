import { Meta, StoryObj } from '@storybook/react';
import { EmailPage, emailPageArgTypes } from '../preview/EmailPage';

const meta = {
	title: 'Email/Pages/Selbsthilfe-Termin',
	component: EmailPage,
	argTypes: emailPageArgTypes,
	args: {
		id: 'selbsthilfe-termin-bestaetigt-teilnahme' as const,
		locale: 'de-sie' as const
	},
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Four appointment events for participants and counselors. Inbox text deliberately contains no group, topic or person identity. The individual physical appointment mail remains separate.'
			}
		}
	}
} satisfies Meta<typeof EmailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ParticipantConfirmed: Story = {};
export const ParticipantRescheduled: Story = {
	args: { id: 'selbsthilfe-termin-verschoben-teilnahme' }
};
export const ParticipantCancelled: Story = {
	args: { id: 'selbsthilfe-termin-abgesagt-teilnahme' }
};
export const ParticipantReminder: Story = {
	args: { id: 'selbsthilfe-termin-erinnerung-teilnahme' }
};
export const CounselorConfirmed: Story = {
	args: { id: 'selbsthilfe-termin-bestaetigt-beratung' }
};
export const CounselorRescheduled: Story = {
	args: { id: 'selbsthilfe-termin-verschoben-beratung' }
};
export const CounselorCancelled: Story = {
	args: { id: 'selbsthilfe-termin-abgesagt-beratung' }
};
export const CounselorReminder: Story = {
	args: { id: 'selbsthilfe-termin-erinnerung-beratung' }
};
export const NarrowPhone: Story = { args: { width: 320 } };
export const PlainText: Story = { args: { view: 'text' } };
