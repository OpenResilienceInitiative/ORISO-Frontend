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

/**
 * A stand-in for the software keyboard, and the `visualViewport` reading that
 * comes with it.
 *
 * A headless browser has no keyboard, and Storybook cannot summon one — but the
 * only thing the bar ever learns about a keyboard is `window.visualViewport`
 * reporting a shorter visible area than the layout viewport. Reporting exactly
 * that, and drawing a block where the keyboard would be, shows the bar's real
 * answer rather than a mock-up of it: with the fix the bar sits on the block,
 * without it the block covers the bar.
 *
 * The patch is put back on unmount, and is skipped if it is already in place,
 * so no other story ever sees it.
 */
const FAKE_VIEWPORT = '__orisoStorybookFakeViewport';

const WithOpenKeyboard = ({
	covered,
	children
}: {
	covered: number;
	children: React.ReactNode;
}) => {
	/* Installed while rendering, not in an effect: the bar reads the viewport
	   in its own effect, which runs after this component's children. */
	const [previous] = React.useState(() => {
		const current = window.visualViewport as any;
		if (current?.[FAKE_VIEWPORT]) {
			return undefined;
		}
		const descriptor = Object.getOwnPropertyDescriptor(
			window,
			'visualViewport'
		);
		Object.defineProperty(window, 'visualViewport', {
			configurable: true,
			value: {
				[FAKE_VIEWPORT]: true,
				height: window.innerHeight - covered,
				offsetTop: 0,
				addEventListener: () => undefined,
				removeEventListener: () => undefined
			}
		});
		return descriptor ?? null;
	});

	React.useEffect(
		() => () => {
			if (previous === undefined) {
				return;
			}
			if (previous) {
				Object.defineProperty(window, 'visualViewport', previous);
			} else {
				delete (window as any).visualViewport;
			}
		},
		[previous]
	);

	return (
		<>
			{children}
			<Box
				aria-hidden
				data-cy="storybook-keyboard-standin"
				sx={{
					position: 'fixed',
					left: 0,
					right: 0,
					bottom: 0,
					height: `${covered}px`,
					zIndex: 70,
					bgcolor: '#2b2b2b',
					color: 'rgba(255, 255, 255, 0.72)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontSize: 13,
					letterSpacing: '0.4px'
				}}
			>
				Bildschirmtastatur ({covered} px)
			</Box>
		</>
	);
};

export const KeyboardOpen: Story = {
	name: 'Mobil, Tastatur offen',
	globals: phone375Globals,
	args: {
		primary: { label: 'Weiter' }
	},
	render: (args) => (
		<Page>
			<WithOpenKeyboard covered={336}>
				<RegistrationFooter {...args} />
			</WithOpenKeyboard>
		</Page>
	),
	parameters: {
		docs: {
			description: {
				story: 'Der Postleitzahl-Schritt auf dem Telefon: die Zahlentastatur verdeckt 336 px. `position: fixed; bottom: 0` meint den Layout-Viewport, und den verkleinert die Tastatur nicht — die Leiste läge also dahinter. Sie misst über `window.visualViewport`, wie viel verdeckt ist, und setzt sich darüber. Schließt die Tastatur, geht sie an den Rand zurück.'
			}
		}
	}
};
