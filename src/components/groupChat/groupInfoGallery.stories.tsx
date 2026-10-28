import { expectWaitingRoomLayout } from '../app/registrationLoader/waitingRoomLayoutContract';
import * as React from 'react';
import { expect, waitFor, within } from 'storybook/test';
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
	id: 'group-chat-self-help-info',
	title: 'Entry flows/Self-help groups/Group information',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Die Info-Galerie der Selbsthilfegruppe: drei Karten zum Scrollen — Format und Begleitung, Termine, Anonymität — mit „Zurück zum Countdown“. Abnahmefläche neben `Entry flows/Self-help groups/Entry room`.'
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
							/* Fixed, not minimum: in the room this column is what
							   is left between header and bar, and the panel
							   scrolls inside it. A minimum let the story grow a
							   scrollbar the real screen never has. */
							height: {
								xs: 'calc(100vh - 96px)',
								lg: 'calc(100vh - 128px)'
							},
							minHeight: 0,
							display: 'flex',
							flexDirection: 'column',
							px: { xs: 2.5, sm: 5 },
							pt: { xs: 3, sm: 4 },
							pb: { xs: 4, sm: 5 }
						}}
					>
						<GroupInfoGallery onBack={() => undefined} />
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
	play: async ({ canvasElement }) => {
		// A part on its own, not a whole room: only the card size applies.
		await expectWaitingRoomLayout(canvasElement, {
			frame: false,
			cards: true
		});
	},
	parameters: {
		docs: {
			description: {
				story: 'Auf 1440 pt: die Karten stehen als Block in der weißen Spalte, das Bild quadratisch und beschnitten, der Text auf drei Zeilen begrenzt — genau wie im Live-Chat-Warteraum, weil es dasselbe Karussell ist. Oben links führt „Zurück zum Countdown“ zurück; die Galerie schiebt sich von rechts herein und wieder hinaus.'
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

/* A common laptop is shorter than 1440 × 900: the cards keep their height,
   and since #1689 nothing stands under them any more — the dates have their
   own view behind the bar's "Alle Termine". */
export const InfoGalleryLaptop: StoryObj = {
	name: '3 — Laptop 1366 × 768, nur Karten',
	globals: { viewport: { value: 'desktop1366' } },
	render: () => <Screen />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const back = await canvas.findByTestId('group-info-back');
		const cards = await waitFor(() => {
			const found = canvasElement.querySelectorAll<HTMLElement>(
				'[data-cy^="handover-card-"]'
			);
			expect(found.length).toBeGreaterThan(0);
			return found;
		});
		await expect(canvas.queryByText('Die nächsten Treffen')).toBeNull();
		// The way back is a visible button above the cards, once slid in.
		await waitFor(() => expect(back).toBeVisible());
		await expect(back.className).toContain('MuiButton-outlined');
		const cardTop = Math.min(
			...Array.from(cards).map((c) => c.getBoundingClientRect().top)
		);
		await expect(back.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			cardTop
		);
	},
	parameters: {
		docs: {
			description: {
				story: 'Nur die drei Karten (Frank, 19.10.: die Termine liefen in die Karten). Die Termine stehen jetzt hinter „Alle Termine“ in der Leiste; „Zurück zum Countdown“ ist ein sichtbarer Knopf.'
			}
		}
	}
};
