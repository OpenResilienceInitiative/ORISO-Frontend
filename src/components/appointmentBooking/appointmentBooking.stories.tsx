import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { AppointmentBookingPanel } from './AppointmentBookingPanel';
import { StageLayout } from '../stageLayout/StageLayout';
import { Stage } from '../stage/stage';
import { AgencySpecificContext } from '../../globalState';
import {
	LegalLinksContext,
	TProvidedLegalLink
} from '../../globalState/provider/LegalLinksProvider';
import {
	desktop1440Globals,
	phone375Globals
} from '../message/messageStoryShell';

/**
 * "Termin buchen" — Frank, 2026-09-07: booking a date must not start with a
 * login field, it must start with a calendar ("Da sollte wahrscheinlich eher
 * ein Kalender sein"), the month view to click back and forth in, and it opens
 * the way "Mehr erfahren" opens: as its own module sliding in from the right.
 *
 * The month grid is `OrisoCalendar` from the design system, not a second
 * calendar and not a new date library. The times below it are a fixed
 * working-day grid for this first working version; real availability comes
 * from the backend later, and no endpoint is invented here.
 */
const meta: Meta = {
	title: 'Booking/Appointment',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Die Terminbuchung als eigenes Modul: Monatskalender zum Blättern, darunter die freien Zeiten des gewählten Tages, unten „Termin buchen“. Schiebt sich wie die Info-Galerie von rechts herein und mit „Zurück zum Warteraum“ wieder hinaus.'
			}
		}
	}
};

export default meta;

const legalLinks: TProvidedLegalLink[] = [
	{
		label: 'login.legal.infoText.dataprotection',
		registration: true,
		getUrl: () => 'https://oriso.example/datenschutz'
	} as TProvidedLegalLink,
	{
		label: 'login.legal.infoText.impressum',
		registration: true,
		getUrl: () => 'https://oriso.example/impressum'
	} as TProvidedLegalLink
];

/** The waiting room's frame, so the panel is judged where it will stand. */
const Screen = () => (
	<LegalLinksContext.Provider value={legalLinks}>
		<AgencySpecificContext.Provider
			value={{
				specificAgency: null,
				setSpecificAgency: () => undefined
			}}
		>
			<Box sx={{ minHeight: '100vh' }}>
				<StageLayout
					className="stageLayout--registration"
					showLegalLinks={true}
					showLoginLink={false}
					showRegistrationLink={false}
					stage={<Stage hasAnimation={false} />}
					mobileHero="bar"
				>
					<Box
						sx={{
							width: '100%',
							minWidth: 0,
							maxWidth: '100%',
							minHeight: {
								xs: 'calc(100vh - 96px)',
								lg: 'calc(100vh - 128px)'
							},
							display: 'flex',
							flexDirection: 'column',
							px: { xs: 2, sm: 5 },
							pt: { xs: 3, sm: 4 },
							pb: { xs: 4, sm: 5 }
						}}
					>
						<AppointmentBookingPanel
							onBack={() => undefined}
							onConfirm={() => undefined}
						/>
					</Box>
				</StageLayout>
			</Box>
		</AgencySpecificContext.Provider>
	</LegalLinksContext.Provider>
);

export const BookingDesktop: StoryObj = {
	name: '1 — Termin buchen, Desktop',
	globals: desktop1440Globals,
	render: () => <Screen />,
	parameters: {
		docs: {
			description: {
				story: 'Auf 1440 pt: derselbe Bühnenrahmen wie der Warteraum, im weißen Teil der Monatskalender des Designsystems — mit Pfeilen und den beiden Klapplisten für Monat und Jahr. Vergangene Tage sind gesperrt. Erst wenn ein Tag steht, erscheinen die Zeiten; erst wenn Tag und Zeit stehen, ist „Termin buchen“ frei.'
			}
		}
	}
};

export const BookingMobile: StoryObj = {
	name: '2 — Termin buchen, mobil',
	globals: phone375Globals,
	render: () => <Screen />,
	parameters: {
		docs: {
			description: {
				story: 'Auf 375 pt: derselbe Kalender, zentriert, und die Zeiten darunter als umbrechende Reihe. Der Kalender ist die breiteste Kachel der Seite — sie darf schrumpfen, aber nichts darf seitlich hinauslaufen.'
			}
		}
	}
};
