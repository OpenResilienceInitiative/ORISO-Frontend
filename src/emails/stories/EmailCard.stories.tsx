import { Meta, StoryObj } from '@storybook/react';
import { EmailFragment, emailFragmentArgTypes } from '../preview/EmailFragment';
import {
	emailAssurance,
	emailCallToAction,
	emailDataPanel,
	emailFootnote,
	emailProse,
	emailSecondaryAction,
	emailTitleGroup
} from '../kit/emailMolecules';
import { emailSampleBrand } from '../kit/emailTokens';

const meta = {
	title: 'Email/Organisms/Card',
	component: EmailFragment,
	argTypes: emailFragmentArgTypes,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'The white card: the message itself, minus envelope. Rounded 24px, 1px outline, on the tinted canvas.\n\nThe row order is fixed for every mail — accent rule, headline, copy, optional data panel, action, optional secondary link, footnote, divider, assurance. That fixed order is what makes very different occasions feel like one sender. `bgcolor` is repeated next to `background-color` because Outlook ignores the CSS property on a table and would otherwise leave the card transparent.'
			}
		}
	}
} satisfies Meta<typeof EmailFragment>;

export default meta;
type Story = StoryObj<typeof meta>;

const assurance =
	'Ihre Nachrichten sind Ende-zu-Ende verschlüsselt. Niemand außer Ihnen und Ihrer Beratung kann sie lesen – auch wir nicht.';

/** The shortest shape: copy and one action. */
const minimal =
	emailTitleGroup('Sie haben eine neue Nachricht', emailSampleBrand) +
	emailProse([
		'In Ihrer Beratung bei {{platformName}} liegt eine neue Nachricht für Sie bereit.',
		'Aus Datenschutzgründen zeigen wir hier weder Inhalt noch Namen. Sie lesen die Nachricht verschlüsselt nach der Anmeldung.'
	]) +
	emailCallToAction(
		{ label: 'Zur Nachricht', href: '{{messageUrl}}' },
		emailSampleBrand
	) +
	emailFootnote(
		'Sie müssen nicht sofort antworten. Die Nachricht bleibt in Ihrem Postfach, solange Sie sie brauchen.'
	) +
	emailAssurance(assurance);

/** The fullest shape: data panel plus two actions. */
const full =
	emailTitleGroup('Ihr Termin ist bestätigt', emailSampleBrand) +
	emailProse([
		'Wir haben Ihren Termin notiert. Sie brauchen nichts vorzubereiten – kommen Sie einfach, wie Sie sind.'
	]) +
	emailDataPanel([
		{ label: 'Datum', value: '{{appointmentDate}}' },
		{ label: 'Uhrzeit', value: '{{appointmentTime}} Uhr' },
		{ label: 'Art', value: '{{appointmentType}}' },
		{ label: 'Ort', value: '{{locationName}}<br>{{locationAddress}}' }
	]) +
	emailCallToAction(
		{ label: 'Termin ansehen', href: '{{appointmentUrl}}' },
		emailSampleBrand
	) +
	emailSecondaryAction(
		{ label: 'Adresse auf der Karte öffnen', href: '{{mapUrl}}' },
		emailSampleBrand
	) +
	emailFootnote(
		'Sie erhalten 24 Stunden vorher eine Erinnerung. Absagen ist jederzeit möglich.'
	) +
	emailAssurance(assurance);

export const Minimal: Story = {
	name: 'Minimal (copy + action)',
	args: { fragment: minimal, width: 700 }
};

export const WithDataPanel: Story = {
	name: 'Full (panel + two actions)',
	args: { fragment: full, width: 700 }
};

export const OnPhone: Story = {
	args: { fragment: full, width: 375 }
};

export const OnNarrowPhone: Story = {
	name: 'Narrow phone (320px)',
	args: { fragment: full, width: 320 }
};

export const OtherTenantColours: Story = {
	name: 'Other tenant colours',
	args: {
		fragment:
			emailTitleGroup('Ihr Termin ist bestätigt', {
				...emailSampleBrand,
				accentColor: '#8657b8'
			}) +
			emailProse(['Wir haben Ihren Termin notiert.']) +
			emailCallToAction(
				{ label: 'Termin ansehen', href: '{{appointmentUrl}}' },
				{ ...emailSampleBrand, primaryColor: '#5b2a86' }
			) +
			emailAssurance(assurance),
		width: 700
	}
};
