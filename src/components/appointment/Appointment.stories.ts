import { Meta, StoryObj } from '@storybook/react';
import { Appointment } from './Appointment';

const meta = {
	title: 'Organisms/Appointment',
	component: Appointment,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'A single appointment card showing date, time, video-call link, QR code and edit/delete actions.'
			}
		}
	}
} satisfies Meta<typeof Appointment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		appointment: {
			id: 'appointment-1',
			status: 'created',
			description: 'Erstgespräch zur Beratung.',
			datetime: '2026-07-01T10:30:00.000Z'
		},
		editClick: () => {},
		deleteClick: () => {}
	}
};

export const LongDescription: Story = {
	args: {
		appointment: {
			id: 'appointment-2',
			status: 'created',
			description:
				'Dies ist ein ausführlicher Termin mit einer langen Beschreibung, die den Vorschau-Grenzwert überschreitet und damit den "Mehr anzeigen" Umschalter sichtbar macht, um den vollständigen Text einzublenden.',
			datetime: '2026-07-02T14:00:00.000Z'
		},
		editClick: () => {},
		deleteClick: () => {}
	}
};
