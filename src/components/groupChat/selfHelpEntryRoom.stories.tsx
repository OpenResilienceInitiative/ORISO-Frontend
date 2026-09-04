import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { WaitingAreaCountdown } from './waitingClock/WaitingAreaCountdown';
import { WaitingAreaRules } from './WaitingAreaRules';
import { registrationMd3 } from '../registration/registrationDesign/registrationDesign';
import { phone375Globals } from '../message/messageStoryShell';

/**
 * The self-help group entry room — every view a person passes through between
 * "I clicked the invitation" and "I am in the group".
 *
 * Frank, 2026-09-04: the clocks exist and are good, they are already in the
 * chat, and they belong here too. Seeing all the views next to each other is
 * what tells us which texts we actually need and whether a modal is required
 * mid-flow.
 *
 * What is deliberately reused, not rebuilt: `WaitingAreaCountdown` (design 4a/4b)
 * and `WaitingAreaRules` are the components `JoinGroupChatView` already renders.
 * Nothing here invents a second waiting room.
 *
 * The open product question these views are meant to settle: someone who joined
 * temporarily probably should not get the full waiting area with menus and
 * calendar export — they have no account to export to. The "plain" stories below
 * are the proposal for that; the "full" ones are what an account holder sees.
 */
const meta: Meta = {
	title: 'Group chat/Self-help entry room',
	parameters: {
		docs: {
			description: {
				component:
					'Alle Ansichten des Eintrittsraums für Selbsthilfegruppen, mit der vorhandenen Warteuhr. Abnahmefläche zu ORISO-Frontend#921 und #1293. Nichts davon ist verdrahtet.'
			}
		}
	}
};

export default meta;

const RULES = [
	'Was hier gesagt wird, bleibt hier.',
	'Jede Person spricht für sich selbst.',
	'Niemand muss etwas sagen.',
	'Wir lassen einander ausreden.'
];

const WELCOME =
	'Schön, dass Sie da sind. Ich bin Carimat und begleite die Gruppe heute.';

/* A fixed "now" so the story is stable: the countdown ticks live in the app but
   a moving clock makes a screenshot review impossible. */
const NOW = Date.UTC(2026, 8, 4, 14, 0, 0);
const IN_THREE_DAYS = new Date(NOW + 3 * 24 * 3600e3 + 5 * 3600e3 + 12 * 60e3);
const IN_TWELVE_MINUTES = new Date(NOW + 12 * 60e3);
const OVERDUE = new Date(NOW - 7 * 60e3);

const Room = ({ children }: { children: React.ReactNode }) => (
	<Box
		sx={{
			minHeight: '100vh',
			bgcolor: registrationMd3.surface,
			display: 'flex',
			justifyContent: 'center',
			px: { xs: 2, sm: 4 },
			py: { xs: 3, sm: 5 }
		}}
	>
		<Box sx={{ width: '100%', maxWidth: 720 }}>{children}</Box>
	</Box>
);

const Caption = ({ children }: { children: React.ReactNode }) => (
	<Typography
		sx={{
			fontSize: 12,
			letterSpacing: '.08em',
			textTransform: 'uppercase',
			color: registrationMd3.onSurfaceVariant,
			mb: 1.5
		}}
	>
		{children}
	</Typography>
);

export const FarFuture: StoryObj = {
	name: '1 — Termin in drei Tagen',
	render: () => (
		<Room>
			<Caption>Eingeladen · Gruppe startet in drei Tagen</Caption>
			<WaitingAreaCountdown
				plannedStart={IN_THREE_DAYS}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
			/>
		</Room>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der häufigste Fall: Der Link kommt Tage vorher. Die Uhr ist hier kein Countdown-Druck, sondern eine Zusage — der Termin steht, der Platz ist da. Die Karten lassen sich umdrehen: hinter den Zahlen stehen Begrüßung und Netiquette. Das ist der Ort für die Texte, die wir noch schreiben müssen.'
			}
		}
	}
};

export const MinutesAway: StoryObj = {
	name: '2 — Gleich geht es los',
	render: () => (
		<Room>
			<Caption>Eingeladen · Gruppe startet in wenigen Minuten</Caption>
			<WaitingAreaCountdown
				plannedStart={IN_TWELVE_MINUTES}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
			/>
		</Room>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Kurz davor. Hier entscheidet sich, ob die Uhr beruhigt oder drängt — dieselbe Anzeige, ganz andere Wirkung als in Ansicht 1. Wenn sie drängt, brauchen wir für diesen Bereich einen eigenen Text.'
			}
		}
	}
};

export const Overdue: StoryObj = {
	name: '3 — Läuft schon',
	render: () => (
		<Room>
			<Caption>Eingeladen · Gruppe läuft bereits</Caption>
			<WaitingAreaCountdown
				plannedStart={OVERDUE}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
			/>
		</Room>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Mensch kommt zu spät — oder klickt den Link, während die Gruppe schon spricht. Genau hier ist Franks offene Frage: braucht es an dieser Stelle ein Modal, das fragt „jetzt dazukommen?", statt ihn stumm hineinzuschieben? Die Uhr zählt heute einfach hoch.'
			}
		}
	}
};

export const PlainForTemporaryGuest: StoryObj = {
	name: '4 — Schlichte Ansicht (ohne Konto)',
	render: () => (
		<Room>
			<Caption>Ohne Konto beigetreten</Caption>
			<Box
				sx={{
					p: 3,
					borderRadius: '20px',
					border: `1px solid ${registrationMd3.outlineVariant}`,
					bgcolor: registrationMd3.surfaceContainerLowest
				}}
			>
				<Typography sx={{ fontSize: 22, fontWeight: 700, mb: '6px' }}>
					Sie sind angemeldet
				</Typography>
				<Typography
					sx={{
						fontSize: 15,
						color: registrationMd3.onSurfaceVariant,
						mb: '20px'
					}}
				>
					Die Gruppe beginnt in 12 Minuten. Noch ist niemand da — das
					ist normal.
				</Typography>
				<WaitingAreaRules rules={RULES} />
			</Box>
		</Room>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Vorschlag für jemanden ohne Konto: dieselbe Information, ohne Kalender-Export und ohne Menüs, die ins Leere führen. „Noch ist niemand da — das ist normal" ist der wichtigste Satz auf diesem Bildschirm: ein leerer Raum kurz vor dem Start fühlt sich sonst nach einem Fehler an.'
			}
		}
	}
};

export const MobileFarFuture: StoryObj = {
	name: '5 — Mobil, Termin in drei Tagen',
	globals: phone375Globals,
	render: () => (
		<Room>
			<Caption>Mobil · in drei Tagen</Caption>
			<WaitingAreaCountdown
				plannedStart={IN_THREE_DAYS}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
			/>
		</Room>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Die Uhr auf 375 pt. Vier Zifferngruppen nebeneinander sind hier die Belastungsprobe — hier zeigt sich, ob sie umbrechen müssen.'
			}
		}
	}
};

export const MobileOverdue: StoryObj = {
	name: '6 — Mobil, läuft schon',
	globals: phone375Globals,
	render: () => (
		<Room>
			<Caption>Mobil · läuft bereits</Caption>
			<WaitingAreaCountdown
				plannedStart={OVERDUE}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
			/>
		</Room>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Der Überzieh-Zustand mobil. Achtung, bekannter Fehler: ab 100 überfälligen Minuten zeigt die Ziffernanzeige „00", während die Vorlesehilfe „100" ansagt — dokumentiert in ORISO-Frontend#1293.'
			}
		}
	}
};

export const ReducedMotion: StoryObj = {
	name: '7 — Ohne Bewegung',
	render: () => (
		<Room>
			<Caption>Bewegung abgeschaltet</Caption>
			<WaitingAreaCountdown
				plannedStart={IN_THREE_DAYS}
				welcomeText={WELCOME}
				rules={RULES}
				nowMs={NOW}
				reducedMotion
			/>
		</Room>
	),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				story: 'Dieselbe Uhr für Menschen, die Bewegung nicht vertragen. Gehört in jede Abnahme: eine Warteansicht, die sich ständig bewegt, ist für manche unbenutzbar.'
			}
		}
	}
};
