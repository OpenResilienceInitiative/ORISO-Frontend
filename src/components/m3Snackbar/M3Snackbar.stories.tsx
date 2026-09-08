import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { M3Snackbar } from './M3Snackbar';
import { registrationMd3 } from '../registration/registrationDesign/registrationDesign';
import { phone375Globals } from '../message/messageStoryShell';

const meta = {
	title: 'Molecules/M3Snackbar',
	component: M3Snackbar,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'Die Snackbar aus dem Design-System (Design-System-M3_ORISO, Knoten 53977-34279). Sie sagt kurz etwas und verschwindet wieder — die einzige Fläche der App, die absichtlich nicht zur Seite gehört, auf der sie liegt: dunkle Inverse-Rolle, heller Text, die Aktion in Inverse-Primary. Alle Farben kommen aus der Tenant-Palette (`--m3-inverse-*`), keine ist hier von Hand gesetzt. Zehn Formen zeichnet das Design-System: ein- oder zweizeilig, ohne Aktion / mit Aktion daneben / mit langer Aktion in eigener Zeile, jeweils mit und ohne Schließen-Kreuz. Alle zehn sind dieselbe Komponente mit anderen Props.'
			}
		}
	}
} satisfies Meta<typeof M3Snackbar>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => undefined;

/* A page behind the bars, so the dark surface is seen against something rather
   than against white — that contrast is the whole point of the inverse role. */
const Page = ({ children }: { children: React.ReactNode }) => (
	<Box
		sx={{
			minHeight: '100vh',
			bgcolor: registrationMd3.surface,
			p: 3,
			display: 'flex',
			flexDirection: 'column',
			gap: 2,
			alignItems: 'flex-start'
		}}
	>
		{children}
	</Box>
);

const Label = ({ children }: { children: React.ReactNode }) => (
	<Typography
		sx={{
			color: registrationMd3.onSurfaceVariant,
			fontSize: 12,
			letterSpacing: '0.4px',
			textTransform: 'uppercase'
		}}
	>
		{children}
	</Typography>
);

const SINGLE_LINE = 'Single-line snackbar';
const TWO_LINE =
	'Zweizeilige Snackbar, weil der Satz länger ist als eine Zeile';

/**
 * The sheet the design system publishes, in one story, so a reviewer can see
 * that the ten shapes really are one component and compare them the way Figma
 * lays them out.
 */
export const AlleVarianten: Story = {
	name: 'Alle zehn Varianten',
	args: { message: SINGLE_LINE },
	render: () => (
		<Page>
			<Label>Einzeilig</Label>
			<M3Snackbar placement="inline" message={SINGLE_LINE} />
			<M3Snackbar
				placement="inline"
				message={SINGLE_LINE}
				onClose={noop}
				closeLabel="Schließen"
			/>
			<Label>Einzeilig mit Aktion</Label>
			<M3Snackbar
				placement="inline"
				message={SINGLE_LINE}
				action={{ label: 'Aktion', onClick: noop }}
			/>
			<M3Snackbar
				placement="inline"
				message={SINGLE_LINE}
				action={{ label: 'Aktion', onClick: noop }}
				onClose={noop}
				closeLabel="Schließen"
			/>
			<Label>Zweizeilig</Label>
			<M3Snackbar placement="inline" message={TWO_LINE} />
			<M3Snackbar
				placement="inline"
				message={TWO_LINE}
				onClose={noop}
				closeLabel="Schließen"
			/>
			<Label>Zweizeilig mit Aktion</Label>
			<M3Snackbar
				placement="inline"
				message={TWO_LINE}
				action={{ label: 'Aktion', onClick: noop }}
			/>
			<M3Snackbar
				placement="inline"
				message={TWO_LINE}
				action={{ label: 'Aktion', onClick: noop }}
				onClose={noop}
				closeLabel="Schließen"
			/>
			<Label>Zweizeilig mit langer Aktion</Label>
			<M3Snackbar
				placement="inline"
				message={TWO_LINE}
				action={{ label: 'Längere Aktion', onClick: noop }}
				actionOnOwnLine
			/>
			<M3Snackbar
				placement="inline"
				message={TWO_LINE}
				action={{ label: 'Längere Aktion', onClick: noop }}
				actionOnOwnLine
				onClose={noop}
				closeLabel="Schließen"
			/>
		</Page>
	),
	parameters: {
		docs: {
			description: {
				story: 'Die zehn Formen aus Figma in derselben Reihenfolge. Die Zeilenzahl ist kein Prop — sie ergibt sich aus dem Text, deshalb gibt es nichts, was zwischen Inhalt und Form auseinanderlaufen könnte.'
			}
		}
	}
};

export const Einzeilig: Story = {
	name: 'Einzeilig',
	args: { message: SINGLE_LINE, placement: 'inline' },
	render: (args) => (
		<Page>
			<M3Snackbar {...args} />
		</Page>
	),
	parameters: {
		docs: {
			description: {
				story: 'Die knappste Form: eine Aussage, sonst nichts. Ohne Kreuz und ohne Aktion verschwindet sie von selbst — ein Hinweis, der niemanden aufhält.'
			}
		}
	}
};

export const MitAktion: Story = {
	name: 'Mit Aktion',
	args: {
		message: SINGLE_LINE,
		placement: 'inline',
		action: { label: 'Rückgängig', onClick: noop }
	},
	render: (args) => (
		<Page>
			<M3Snackbar {...args} />
		</Page>
	),
	parameters: {
		docs: {
			description: {
				story: 'Höchstens eine Aktion. Zwei wären ein Dialog, und ein Dialog hält an — genau das soll eine Snackbar nicht.'
			}
		}
	}
};

export const LangeAktion: Story = {
	name: 'Lange Aktion in eigener Zeile',
	args: {
		message: TWO_LINE,
		placement: 'inline',
		actionOnOwnLine: true,
		action: { label: 'Zur Datenschutzerklärung', onClick: noop },
		onClose: noop,
		closeLabel: 'Schließen'
	},
	render: (args) => (
		<Page>
			<M3Snackbar {...args} />
		</Page>
	),
	parameters: {
		docs: {
			description: {
				story: 'Eine lange Beschriftung neben dem Text würde die Nachricht zu einer schmalen Spalte quetschen. Sieben Sprachen teilen sich diese Fläche, und Deutsch ist nicht die längste — deshalb bekommt die Aktion eine eigene Zeile, rechtsbündig, und das Kreuz bleibt oben.'
			}
		}
	}
};

export const Schwebend: Story = {
	name: 'Schwebend (echte Snackbar)',
	args: {
		message: 'Ihre Nachricht wurde gesendet.',
		action: { label: 'Rückgängig', onClick: noop },
		onClose: noop,
		closeLabel: 'Schließen'
	},
	render: (args) => (
		<Page>
			<Typography
				sx={{ color: registrationMd3.onSurface, maxWidth: 540 }}
			>
				Seiteninhalt. Die Snackbar liegt unten mittig über der Seite und
				geht von einem Klick daneben nicht weg — ein Hinweis, den
				niemand gelesen hat, verschwindet nicht, nur weil jemand das
				Formular dahinter angefasst hat.
			</Typography>
			<M3Snackbar {...args} />
		</Page>
	),
	parameters: {
		docs: {
			description: {
				story: 'Die Vorgabe: MUIs `Snackbar`, fest unten in der Mitte. Die `inline`-Fassung der anderen Storys ist dieselbe Fläche, nur im Textfluss — für die Stelle im Formular, an der der Hinweis stehen muss und nicht darüber.'
			}
		}
	}
};

export const Mobil: Story = {
	name: 'Mobil (375 pt)',
	globals: phone375Globals,
	args: {
		message: TWO_LINE,
		placement: 'inline',
		action: { label: 'Aktion', onClick: noop },
		onClose: noop,
		closeLabel: 'Schließen'
	},
	render: (args) => (
		<Page>
			<M3Snackbar {...args} />
		</Page>
	),
	parameters: {
		docs: {
			description: {
				story: 'Auf dem Telefon ist die 344-pt-Breite fast die ganze Seite. Hier zeigt sich, ob Nachricht, Aktion und Kreuz nebeneinander noch tragen — oder ob die Aktion eine eigene Zeile braucht.'
			}
		}
	}
};
