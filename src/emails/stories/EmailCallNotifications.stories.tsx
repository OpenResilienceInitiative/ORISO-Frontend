import * as React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { EmailId } from '../content/emailCatalogue';
import { EmailPage, EmailToneRow } from '../preview/EmailPage';

const ids: EmailId[] = [
	'anruf-erinnerung',
	'anruf-einladung',
	'anruf-verpasst'
];

const meta = {
	title: 'Email/Pages/Call notifications',
	component: EmailPage,
	args: { id: 'anruf-erinnerung', locale: 'de-sie' },
	parameters: {
		docs: {
			description: {
				component:
					'Privacy-neutral lifecycle e-mails for scheduled call reminders, invitations and missed calls. Subjects and lock-screen previews omit topics, names and participant details.'
			}
		}
	}
} satisfies Meta<typeof EmailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllLanguages: Story = {
	name: 'All occasions · all languages',
	render: () => (
		<div style={{ display: 'grid', gap: 32 }}>
			{ids.map((id) => (
				<section key={id}>
					<h2>{id}</h2>
					<EmailToneRow id={id} />
				</section>
			))}
		</div>
	)
};

export const Reminder: Story = {
	name: 'Scheduled call reminder',
	args: { id: 'anruf-erinnerung' }
};

export const Invitation: Story = {
	name: 'Call invitation',
	args: { id: 'anruf-einladung' }
};

export const MissedCall: Story = {
	name: 'Missed call',
	args: { id: 'anruf-verpasst' }
};
