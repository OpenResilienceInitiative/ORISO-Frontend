import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { RegistrationFooter } from './RegistrationFooter';
import { registrationMd3 } from '../registration/registrationDesign/registrationDesign';
import { phone375Globals } from '../message/messageStoryShell';

const meta = {
	title: 'Molecules/RegistrationFooter',
	component: RegistrationFooter,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Die Leiste am unteren Rand der Registrierungs-Bildschirme. Sie setzt nur Lage und Layout — jede Farbe, jeder Radius und jeder Hover-Zustand kommt aus dem Theme. Zwei gleichrangige Wege oder nur einer.'
			}
		}
	}
} satisfies Meta<typeof RegistrationFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

/* A page behind the bar, so the fixed position and the translucent surface are
   visible instead of floating on white. */
const Page = ({ children }: { children: React.ReactNode }) => (
	<Box
		sx={{
			minHeight: '100vh',
			bgcolor: registrationMd3.surface,
			p: 4
		}}
	>
		<Typography sx={{ maxWidth: 540, color: registrationMd3.onSurface }}>
			Seiteninhalt. Die Leiste liegt fest am unteren Rand und schiebt sich
			über nichts, was links davon steht — deshalb bleiben die Rechtslinks
			der roten Bühne lesbar.
		</Typography>
		{children}
	</Box>
);

export const TwoWays: Story = {
	name: 'Zwei Wege',
	args: {
		secondary: { label: 'Ohne Konto beitreten' },
		primary: { label: 'Registrieren' }
	},
	render: (args) => (
		<Page>
			<RegistrationFooter {...args} />
		</Page>
	),
	parameters: {
		docs: {
			description: {
				story: 'Der Fall des Link-Eintritts: zwei gleichrangige Entscheidungen, eine Geometrie, nur die Rolle unterscheidet sie. Beim Überfahren füllt sich auch der Umriss-Knopf rot — das ist die Theme-Regel, kein Zufall.'
			}
		}
	}
};

export const OneWay: Story = {
	name: 'Nur ein Weg',
	args: {
		primary: { label: 'Weiter' }
	},
	render: (args) => (
		<Page>
			<RegistrationFooter {...args} />
		</Page>
	),
	parameters: {
		docs: {
			description: {
				story: 'Ohne zweiten Weg füllt die Hauptaktion die Leiste. Für Schritte, die nur vorwärts gehen.'
			}
		}
	}
};

export const Disabled: Story = {
	name: 'Hauptaktion gesperrt',
	args: {
		secondary: { label: 'Ohne Konto beitreten' },
		primary: { label: 'Registrieren', disabled: true }
	},
	render: (args) => (
		<Page>
			<RegistrationFooter {...args} />
		</Page>
	),
	parameters: {
		docs: {
			description: {
				story: 'Solange die Zustimmung fehlt, ist der Weg nach vorn gesperrt — aber sichtbar. Hausregel: nie verstecken, nur deaktivieren.'
			}
		}
	}
};

export const LongLabels: Story = {
	name: 'Lange Beschriftungen (Truncating)',
	args: {
		secondary: { label: 'Zonder account deelnemen aan het gesprek' },
		primary: { label: 'Registreren en doorgaan naar het gesprek' }
	},
	render: (args) => (
		<Page>
			<RegistrationFooter {...args} />
		</Page>
	),
	parameters: {
		docs: {
			description: {
				story: 'Sieben Sprachen teilen sich diese Leiste, und Deutsch ist nicht die längste. Was nicht mehr passt, wird abgeschnitten statt den Knopf aus der Leiste zu drücken — der ganze Text bleibt über den Titel erreichbar.'
			}
		}
	}
};

export const Mobile: Story = {
	name: 'Mobil (375 pt)',
	globals: phone375Globals,
	args: {
		secondary: { label: 'Ohne Konto beitreten' },
		primary: { label: 'Registrieren' }
	},
	render: (args) => (
		<Page>
			<RegistrationFooter {...args} />
		</Page>
	),
	parameters: {
		docs: {
			description: {
				story: 'Auf dem Telefon läuft die Leiste über die volle Breite, mit Platz für die Home-Anzeige unten. Hier zeigt sich, ob zwei Knöpfe nebeneinander noch tragen.'
			}
		}
	}
};
