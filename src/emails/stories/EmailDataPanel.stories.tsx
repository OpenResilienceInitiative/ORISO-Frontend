import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import { emailDataPanel } from '../kit/emailMolecules';

const meta = {
	title: 'Email/Molecules/DataPanel',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'The tinted block that holds the facts of a mail: appointment details, contact details, the assigned request, the user name to keep. Anything in here has to survive being skim-read, which is why it is a label/value list rather than a sentence.\n\nFour of the seven mails use it. Below 620px every row stacks — check the 320px stories, where the appointment panel is the worst case in the whole kit.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

const appointment = [
	{ label: 'Datum', value: '{{appointmentDate}}' },
	{ label: 'Uhrzeit', value: '{{appointmentTime}} Uhr' },
	{ label: 'Art', value: '{{appointmentType}}' },
	{ label: 'Ort', value: '{{locationName}}<br>{{locationAddress}}' }
];

const contact = [
	{ label: 'Beratung', value: '{{consultantName}}' },
	{ label: 'Durchwahl', value: '{{consultantPhone}}' },
	{ label: 'Sprechzeiten', value: '{{consultantHours}}' },
	{ label: 'E-Mail', value: '{{consultantEmail}}' }
];

export const Appointment: Story = {
	args: { fragment: emailDataPanel(appointment), width: 700 }
};

export const Contact: Story = {
	args: { fragment: emailDataPanel(contact), width: 700 }
};

export const SingleRow: Story = {
	name: 'Single row (user name)',
	args: {
		fragment: emailDataPanel([
			{ label: 'Benutzername', value: '{{username}}' }
		]),
		width: 700
	}
};

export const AppointmentOnPhone: Story = {
	name: 'Appointment on a phone',
	args: { fragment: emailDataPanel(appointment), width: 375 }
};

export const AppointmentOnNarrowPhone: Story = {
	name: 'Appointment at 320px',
	args: { fragment: emailDataPanel(appointment), width: 320 }
};

export const AsTemplate: Story = {
	name: 'Template (placeholders)',
	args: { fragment: emailDataPanel(appointment), width: 700, filled: false }
};
