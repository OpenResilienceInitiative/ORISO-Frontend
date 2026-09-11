import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import { emailFootnote, emailProse } from '../kit/emailMolecules';

const meta = {
	title: 'Email/Atoms/BodyText',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Body copy at 16/26 and the muted footnote at 14/22. The last paragraph always gets the larger bottom gap, because whatever follows it — the data panel or the button — starts a new visual group. `mso-line-height-rule:exactly` is set so Word does not inflate the leading.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleParagraph: Story = {
	args: {
		fragment: emailProse([
			'In Ihrer Beratung bei {{platformName}} liegt eine neue Nachricht für Sie bereit.'
		]),
		width: 700
	}
};

export const TwoParagraphs: Story = {
	args: {
		fragment: emailProse([
			'In Ihrer Beratung bei {{platformName}} liegt eine neue Nachricht für Sie bereit.',
			'Aus Datenschutzgründen zeigen wir hier weder Inhalt noch Namen. Sie lesen die Nachricht verschlüsselt nach der Anmeldung.'
		]),
		width: 700
	}
};

export const WithFootnote: Story = {
	name: 'Paragraph plus footnote',
	args: {
		fragment:
			emailProse([
				'Wir haben Ihren Termin notiert. Sie brauchen nichts vorzubereiten – kommen Sie einfach, wie Sie sind.'
			]) +
			emailFootnote(
				'Sie erhalten 24 Stunden vorher eine Erinnerung. Absagen ist jederzeit möglich.'
			),
		width: 700
	}
};

export const OnPhone: Story = {
	args: {
		fragment: emailProse([
			'In Ihrer Beratung bei {{platformName}} liegt eine neue Nachricht für Sie bereit.',
			'Aus Datenschutzgründen zeigen wir hier weder Inhalt noch Namen. Sie lesen die Nachricht verschlüsselt nach der Anmeldung.'
		]),
		width: 375
	}
};
