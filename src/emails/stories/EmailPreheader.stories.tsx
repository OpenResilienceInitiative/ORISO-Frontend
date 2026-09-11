import * as React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import { EmailInboxLine } from '../preview/EmailInboxLine';
import { EMAIL_IDS, EMAIL_LOCALES, EMAIL_LOCALE_LABELS } from '../index';

const meta = {
	title: 'Email/Atoms/Preheader',
	component: EmailInboxLine,
	argTypes: {
		id: {
			name: 'Mail',
			control: { type: 'select' as const },
			options: [...EMAIL_IDS]
		},
		locale: {
			name: 'Tone',
			control: { type: 'radio' as const },
			options: [...EMAIL_LOCALES],
			labels: EMAIL_LOCALE_LABELS
		},
		filled: { name: 'Sample data', control: { type: 'boolean' as const } }
	},
	args: { id: 'neue-nachricht' as const, locale: 'de-sie' as const },
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'The hidden `<span>` right after `<body>` that most clients show next to the subject. It is the first — and on a lock screen often the only — thing a recipient reads, which makes it the highest-stakes string in the whole mail. No subject and no preview line in this kit names a person, a topic or a counselling centre. Compare them all under "Every mail".'
			}
		}
	}
} satisfies Meta<typeof EmailInboxLine>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewMessage: Story = {
	name: 'Neue Nachricht',
	args: { id: 'neue-nachricht' }
};

export const Appointment: Story = {
	name: 'Termin (with data)',
	args: { id: 'termin' }
};

export const EveryMail: Story = {
	name: 'Every mail',
	render: (args) => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
			{EMAIL_IDS.map((id) => (
				<EmailInboxLine key={id} id={id} locale={args.locale} />
			))}
		</div>
	)
};

export const AsTemplate: Story = {
	name: 'Template (placeholders)',
	args: { id: 'termin', filled: false }
};
