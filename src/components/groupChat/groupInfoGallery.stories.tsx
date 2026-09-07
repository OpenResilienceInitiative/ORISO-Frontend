import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { GroupInfoGallery } from './entryRoom/GroupInfoGallery';
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
 * The explainer behind "Mehr erfahren" in the self-help waiting room
 * (Frank, 2026-09-06). Same stage, same column — only the content of the white
 * side changes, and it changes by sliding: the gallery comes in from the right
 * edge and moves left into place, the back control takes it out again.
 *
 * The carousel is the module the registration handover and the live chat's
 * waiting room already use, so the card height, the desktop crop, the mobile
 * switch and the line lengths are not decided twice.
 *
 * The copy is provisional — the substance is Frank's, the sentences are
 * stand-ins until he writes them. So are the three motifs, borrowed from the
 * registration set.
 */
const meta: Meta = {
	title: 'Group chat/Self-help info',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Die Info-Galerie der Selbsthilfegruppe: drei Karten zum Scrollen — Format und Begleitung, Termine, Anonymität — mit „Zurück zum Warteraum“. Abnahmefläche neben `Group chat/Self-help entry room`.'
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

/** The waiting room's frame, so the gallery is judged where it will stand. */
const Screen = ({
	withAppointments = false
}: {
	withAppointments?: boolean;
}) => (
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
							px: { xs: 2.5, sm: 5 },
							pt: { xs: 3, sm: 4 },
							pb: { xs: 4, sm: 5 }
						}}
					>
						<GroupInfoGallery
							onBack={() => undefined}
							onOpenAppointments={
								withAppointments ? () => undefined : undefined
							}
						/>
					</Box>
				</StageLayout>
			</Box>
		</AgencySpecificContext.Provider>
	</LegalLinksContext.Provider>
);

export const InfoGalleryDesktop: StoryObj = {
	name: '1 — Info-Galerie, Desktop',
	globals: desktop1440Globals,
	render: () => <Screen />,
	parameters: {
		docs: {
			description: {
				story: 'Auf 1440 pt: die Karten stehen als Block in der weißen Spalte, das Bild quadratisch und beschnitten, der Text auf drei Zeilen begrenzt — genau wie im Live-Chat-Warteraum, weil es dasselbe Karussell ist. Oben links führt „Zurück zum Warteraum“ zurück; die Galerie schiebt sich von rechts herein und wieder hinaus.'
			}
		}
	}
};

export const InfoGalleryMobile: StoryObj = {
	name: '2 — Info-Galerie, mobil',
	globals: phone375Globals,
	render: () => <Screen />,
	parameters: {
		docs: {
			description: {
				story: 'Auf 375 pt: dieselben Karten, aber hoch statt quadratisch — das Karussell schaltet selbst um. Die Karten reichen bis an die Ränder, damit sichtbar bleibt, dass es weitergeht.'
			}
		}
	}
};

export const InfoGalleryWithAppointments: StoryObj = {
	name: '3 — Mit Termin-Aktion',
	globals: desktop1440Globals,
	render: () => <Screen withAppointments />,
	parameters: {
		docs: {
			description: {
				story: 'Karte 2 verspricht, dass man die Termine vorher eintragen kann. Sobald es dafür ein Ziel gibt, reicht die Ansicht `onOpenAppointments` durch und der Knopf steht unter der Galerie. Hier ist kein Link erfunden — die Aktion tut in der Story nichts.'
			}
		}
	}
};
