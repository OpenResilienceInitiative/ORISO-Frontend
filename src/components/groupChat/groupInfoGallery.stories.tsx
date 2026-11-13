import { expectWaitingRoomLayout } from '../app/registrationLoader/waitingRoomLayoutContract';
import * as React from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
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
	phone375Globals,
	tablet820Globals
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

export const InfoGalleryTabletSelection: StoryObj = {
	name: 'Tablet — visible card and current step agree',
	globals: tablet820Globals,
	render: () => (
		<Box
			sx={{
				/* Narrow enough that the fluid cards (2026-11-13: they shrink to
				   fit three across) reach their 12rem floor and the third card
				   is cut off, so the dots have something to scroll. */
				width: 'min(500px, 100%)',
				height: '100vh',
				mx: 'auto',
				display: 'flex',
				flexDirection: 'column'
			}}
		>
			<GroupInfoGallery onBack={() => undefined} />
		</Box>
	),
	play: async ({ canvasElement, canvas }) => {
		await expectWaitingRoomLayout(canvasElement, {
			frame: false,
			cards: true
		});
		const track = canvas.getByRole('list');
		const step = (position: number) =>
			canvas.getByRole('button', {
				name: `Zu Schritt ${position} von 3`
			});
		const end = () => track.scrollWidth - track.clientWidth;
		/* In the track's scroll coordinates, from bounding boxes: the track
		   and its cards are not positioned, so `offsetLeft` would count from
		   another origin (#2139). */
		const cardCentre = (card: HTMLElement) => {
			const box = card.getBoundingClientRect();
			return (
				box.left -
				track.getBoundingClientRect().left +
				track.scrollLeft +
				box.width / 2
			);
		};
		const [firstCard, secondCard, thirdCard] =
			canvas.getAllByRole('listitem');
		const width = track.clientWidth;
		const secondCentre = cardCentre(secondCard);
		await expect(width).toBeGreaterThan(secondCentre);
		await expect(width).toBeLessThan(cardCentre(thirdCard));

		await expect(step(1)).toHaveAttribute('aria-current', 'true');
		await userEvent.click(step(2));
		await expect(step(2)).toHaveAttribute('aria-current', 'true');
		// A click on a card while the dot's smooth scroll may still be under
		// way is a click, not a drag: it must not re-pick the card from a
		// half-way position (ORISO-Admin#1506).
		await userEvent.click(canvas.getAllByRole('img')[0]);
		await expect(step(2)).toHaveAttribute('aria-current', 'true');
		// The dot centres the middle card once its scroll has settled.
		await waitFor(() =>
			expect(track.scrollLeft).toBeCloseTo(
				Math.min(end(), Math.max(0, secondCentre - width / 2)),
				0
			)
		);
		await expect(step(2)).toHaveAttribute('aria-current', 'true');

		await userEvent.click(step(2));
		await userEvent.tab();
		await expect(step(3)).toHaveFocus();
		let activationSettled = !('onscrollend' in track);
		track.addEventListener(
			'scrollend',
			() => {
				activationSettled = true;
			},
			{ once: true }
		);
		await userEvent.keyboard('{Enter}');
		await waitFor(() => {
			expect(track.scrollLeft).toBeCloseTo(end(), 0);
			expect(activationSettled).toBe(true);
		});
		await expect(step(3)).toHaveAttribute('aria-current', 'true');
		await expect(step(3)).toHaveFocus();

		const settledPosition = track.scrollLeft;
		const keepingThirdVisible = Math.floor(
			(width + cardCentre(thirdCard) - settledPosition) / 2
		);
		try {
			// A width change can move the native snap position while keeping
			// the chosen card visible. That move belongs to the resize.
			track.style.width = `${keepingThirdVisible}px`;
			await waitFor(() => {
				expect(track.clientWidth).toBe(keepingThirdVisible);
				expect(track.scrollLeft).not.toBe(settledPosition);
			});
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() =>
					requestAnimationFrame(() => resolve())
				)
			);
			await expect(cardCentre(thirdCard) - track.scrollLeft).toBeLessThan(
				track.clientWidth
			);
			await expect(step(3)).toHaveAttribute('aria-current', 'true');

			// A later real scroll can arrive without a wheel, touch or key
			// event on this track, for example when using a scrollbar.
			track.scrollTo({ left: 0, behavior: 'instant' });
			await waitFor(() => {
				expect(track.scrollLeft).toBe(0);
				expect(step(1)).toHaveAttribute('aria-current', 'true');
			});
		} finally {
			track.style.removeProperty('width');
		}
		await waitFor(() => expect(track.clientWidth).toBe(width));

		await userEvent.click(step(2));
		await expect(step(2)).toHaveAttribute('aria-current', 'true');
		const keepingSecondVisible = Math.floor((width + secondCentre) / 2);
		const clippingSecond = Math.floor(
			(cardCentre(firstCard) + secondCentre) / 2
		);
		try {
			// First shrink the track while it still contains card 2's centre.
			track.style.width = `${keepingSecondVisible}px`;
			await waitFor(() =>
				expect(track.clientWidth).toBe(keepingSecondVisible)
			);
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() =>
					requestAnimationFrame(() => resolve())
				)
			);
			await expect(step(2)).toHaveAttribute('aria-current', 'true');

			// Narrow it past the selected card so the visible card owns the dot.
			track.style.width = `${clippingSecond}px`;
			await waitFor(() => {
				expect(track.clientWidth).toBe(clippingSecond);
				expect(step(1)).toHaveAttribute('aria-current', 'true');
			});
		} finally {
			track.style.removeProperty('width');
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
