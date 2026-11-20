import * as React from 'react';
import { useLayoutEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, waitFor } from 'storybook/test';
import { Stage } from '../../stage/stage';
import { GlobalComponentContext } from '../../../globalState/provider/GlobalComponentContext';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { storyLegalLinks } from '../../waitingRoom/storyLegalLinks';
import { useGroupJoinHandoverCopy } from '../../groupChat/groupJoinHandoverCopy';
import {
	desktop1440Globals,
	phone390Globals
} from '../../message/messageStoryShell';
import { PostRegistrationHandover } from './PostRegistrationHandover';
import {
	HANDOVER_MILESTONES,
	markHandoverMilestone,
	resetHandoverProgress,
	useHandoverProgress
} from './handoverProgress';
import { expectWaitingRoomLayout } from './waitingRoomLayoutContract';
import {
	expectArrowStepsOneCard,
	revealHoverArrow
} from '../../hoverScrollArrows/hoverScrollArrowsStoryPlay';

/**
 * The one waiting room between "Registrieren" and the message field (#1219).
 *
 * Every story renders the real `PostRegistrationHandover` — the component
 * the app mounts after the document load, in the same `WaitingRoomFrame` the
 * registration side uses — so what you see here is what stands on
 * both sides of the document load. Each story checks the layout contract
 * (`waitingRoomLayoutContract.ts`): stage beside the column, the shared bar at
 * the bottom edge, the button across the bar.
 */
const meta: Meta = {
	title: 'Entry flows/Waiting room/After Registrieren',
	parameters: { layout: 'fullscreen' },
	decorators: [
		(Story) => (
			<GlobalComponentContext.Provider value={{ Stage }}>
				<LegalLinksContext.Provider value={storyLegalLinks}>
					{/* `#storybook-root` is not full height; the app root is. */}
					<Box sx={{ minHeight: '100vh' }}>
						<Story />
					</Box>
				</LegalLinksContext.Provider>
			</GlobalComponentContext.Provider>
		)
	]
};

export default meta;

/** Sets the real progress store to "the first `finished` milestones done". */
const Milestones = ({
	finished,
	children
}: {
	finished: number;
	children: React.ReactNode;
}) => {
	useLayoutEffect(() => {
		resetHandoverProgress();
		HANDOVER_MILESTONES.slice(0, finished).forEach(markHandoverMilestone);
		return () => resetHandoverProgress();
	}, [finished]);
	return <>{children}</>;
};

const Waiting = ({ finished }: { finished: number }) => (
	<Milestones finished={finished}>
		<PostRegistrationHandover
			ready={finished >= HANDOVER_MILESTONES.length}
			onEnter={() => undefined}
		/>
	</Milestones>
);

const expectFill = async (canvasElement: HTMLElement, fill: number) => {
	await waitFor(() =>
		expect(
			canvasElement.ownerDocument
				.querySelector('[data-cy="registration-handover"]')
				?.getAttribute('data-cy-progress')
		).toBe(String(fill))
	);
};

export const JustClicked: StoryObj = {
	name: '1 — Registrieren gedrückt (nichts fertig)',
	globals: desktop1440Globals,
	render: () => <Waiting finished={0} />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expectFill(canvasElement, 0);
	}
};

export const AtTheDocumentLoad: StoryObj = {
	name: '2 — Konto da, Seite lädt neu (3 von 7)',
	globals: desktop1440Globals,
	render: () => <Waiting finished={3} />,
	parameters: {
		docs: {
			description: {
				story: 'Der Moment des unsichtbaren Neuladens. Die App-Seite malt danach genau dieses Bild — gleicher Rahmen, gleicher Balken.'
			}
		}
	},
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expectFill(canvasElement, 43);
	}
};

export const AlmostThere: StoryObj = {
	name: '3 — Chat verbunden, Bildschirme laden (6 von 7)',
	globals: desktop1440Globals,
	render: () => <Waiting finished={6} />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expectFill(canvasElement, 86);
	}
};

export const Ready: StoryObj = {
	name: '4 — Alles geladen: Anfrage schreiben',
	globals: desktop1440Globals,
	render: () => <Waiting finished={HANDOVER_MILESTONES.length} />,
	play: async ({ canvasElement, canvas }) => {
		await expectWaitingRoomLayout(canvasElement, { cards: true });
		await expectFill(canvasElement, 100);
		await expect(
			await canvas.findByRole('button', { name: /Anfrage schreiben/i })
		).toBeEnabled();
	}
};

/**
 * ORISO-Frontend#2139: on desktop the dots under "So geht es weiter" stayed
 * on the first card while the cards moved, and every dot jumped to the end,
 * so the visitor could not get back. The carousel measured its cards from the
 * page column instead of from its own track (`offsetLeft` of an unpositioned
 * track), which only matches where the column starts at x = 0 (phones).
 * This drives the real room at 1440 px: scroll, click a dot, drag with the
 * mouse — the active dot follows every time.
 */
export const ReadyDotsFollowTheCards: StoryObj = {
	/* Since the cards size themselves to fit (2026-11-13), all three stand
	   side by side from `sm` up and there is nothing to scroll there; the
	   carousel and its dots live on the phone. */
	name: '4b — Punkte folgen den Karten (Handy, Maus)',
	globals: phone390Globals,
	render: () => <Waiting finished={HANDOVER_MILESTONES.length} />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement, { cards: true });
		const doc = canvasElement.ownerDocument;
		const track = await waitFor(() => {
			const el = doc.querySelector<HTMLElement>(
				'[data-cy="handover-carousel"]'
			);
			expect(el).not.toBeNull();
			expect(el!.scrollWidth).toBeGreaterThan(el!.clientWidth);
			return el!;
		});
		const dots = () =>
			Array.from(
				doc.querySelectorAll<HTMLElement>(
					'[data-cy="handover-carousel-dots"] button'
				)
			);
		const activeDot = () =>
			dots().findIndex(
				(dot) => dot.getAttribute('aria-current') === 'true'
			);
		const last = dots().length - 1;

		// Scrolled to the end: the last dot is the active one.
		track.scrollTo({ left: track.scrollWidth, behavior: 'auto' });
		await waitFor(() => expect(activeDot()).toBe(last));

		// The first dot brings the first card back.
		await userEvent.click(dots()[0]);
		await waitFor(() => {
			expect(track.scrollLeft).toBe(0);
			expect(activeDot()).toBe(0);
		});

		// Dragging with the mouse moves the cards (no trackpad needed) and
		// the nearest card snaps in; the dots follow.
		const rect = track.getBoundingClientRect();
		const y = rect.top + rect.height / 2;
		const startX = rect.left + rect.width - 40;
		await userEvent.pointer([
			{
				keys: '[MouseLeft>]',
				target: track,
				coords: { clientX: startX, clientY: y }
			},
			// The drag takes over from its first move past the threshold
			// (#2222), so a small first step lets the whole way count.
			{ target: track, coords: { clientX: startX - 10, clientY: y } },
			{ target: track, coords: { clientX: startX - 200, clientY: y } },
			{ target: track, coords: { clientX: startX - 500, clientY: y } },
			{
				keys: '[/MouseLeft]',
				target: track,
				coords: { clientX: startX - 500, clientY: y }
			}
		]);
		await waitFor(() => {
			expect(track.scrollLeft).toBe(
				track.scrollWidth - track.clientWidth
			);
			expect(activeDot()).toBe(last);
		});
		await userEvent.click(dots()[0]);
		await waitFor(() => expect(track.scrollLeft).toBe(0));

		// The middle dot centres the middle card, and it stays there once
		// the browser's own snapping has settled.
		await userEvent.click(dots()[1]);
		await waitFor(() => expect(activeDot()).toBe(1));
		await new Promise((resolve) => setTimeout(resolve, 600));
		expect(activeDot()).toBe(1);

		// The last dot goes to the end again.
		await userEvent.click(dots()[last]);
		await waitFor(() => {
			expect(track.scrollLeft).toBe(
				track.scrollWidth - track.clientWidth
			);
			expect(activeDot()).toBe(last);
		});
	}
};

export const ReadyPhone: StoryObj = {
	name: '4 — Alles geladen (Handy 390)',
	globals: phone390Globals,
	render: () => <Waiting finished={HANDOVER_MILESTONES.length} />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

export const PreparingPhone: StoryObj = {
	name: '2 — Seite lädt neu (Handy 390)',
	globals: phone390Globals,
	render: () => <Waiting finished={3} />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

const GroupJoin = () => {
	const copy = useGroupJoinHandoverCopy();
	return (
		<Milestones finished={3}>
			<PostRegistrationHandover
				ready={false}
				forcedState="preparing"
				onEnter={() => undefined}
				copy={copy}
			/>
		</Milestones>
	);
};

export const GroupInvitation: StoryObj = {
	name: 'Gruppen-Einladung: derselbe Warteraum, eigene Worte',
	globals: desktop1440Globals,
	render: () => <GroupJoin />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

/**
 * The whole run, so the fill can be watched. The gaps between steps are
 * made up for the demo — in the app the bar moves only when a step is done.
 */
const Run = () => {
	const progress = useHandoverProgress();
	const [, setTick] = useState(0);
	useLayoutEffect(() => {
		resetHandoverProgress();
		const timers = HANDOVER_MILESTONES.map((milestone, i) =>
			window.setTimeout(
				() => {
					markHandoverMilestone(milestone);
					setTick((n) => n + 1);
				},
				900 * (i + 1)
			)
		);
		return () => {
			timers.forEach(window.clearTimeout);
			resetHandoverProgress();
		};
	}, []);
	return (
		<>
			<PostRegistrationHandover
				ready={progress >= 100}
				onEnter={() => undefined}
			/>
			<Typography
				sx={{
					position: 'fixed',
					top: 8,
					right: 8,
					zIndex: 99,
					px: 1,
					fontSize: 11,
					fontFamily: 'monospace',
					bgcolor: 'rgba(255,255,255,.9)'
				}}
			>
				Vorführung: Abstände erfunden, Schritte echt ({progress} %)
			</Typography>
		</>
	);
};

export const WholeRun: StoryObj = {
	name: 'Ablauf zum Zuschauen',
	globals: desktop1440Globals,
	render: () => <Run />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
	}
};

/* A Träger with its own brand colour (#1735): the stage dots and glow follow
   the primary colour instead of a fixed red. */
export const ReadyBluePrimary: StoryObj = {
	name: '4 — Alles geladen, blaue Trägerfarbe',
	globals: desktop1440Globals,
	render: () => <Waiting finished={HANDOVER_MILESTONES.length} />,
	parameters: { orisoSeed: '#1D4ED8' },
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement, {
			cards: true,
			stageNotRed: true
		});
	}
};

/**
 * Large screens: the cards grow with the window instead of staying 372 px
 * in the left half of the white column with an empty lower half (seen on
 * ORISO Staging on a 2560 px screen, 2026-11-13). The contract fails when a
 * card keeps its laptop size here; this story also checks that all three
 * cards stand side by side, fully above the bar.
 */
const expectCardsUseTheRoom = async (canvasElement: HTMLElement) => {
	await expectWaitingRoomLayout(canvasElement, { cards: true });
	const doc = canvasElement.ownerDocument;
	const cards = [
		...doc.querySelectorAll<HTMLElement>('[data-cy^="handover-card-"]')
	].map((card) => card.getBoundingClientRect());
	const track = doc
		.querySelector<HTMLElement>('[data-cy="handover-carousel"]')!
		.getBoundingClientRect();
	const bar = doc
		.querySelector<HTMLElement>('[data-cy="registration-footer"]')!
		.getBoundingClientRect();
	expect(cards).toHaveLength(3);
	// All three visible in the track, none cut off at its right edge.
	expect(cards[2].right).toBeLessThanOrEqual(track.right + 1);
	// They end above the bar: nothing to scroll to see a whole card.
	expect(cards[0].bottom).toBeLessThan(bar.top);
	// Nothing to scroll sideways either, so no dots.
	expect(doc.querySelector('[data-cy="handover-carousel-dots"]')).toBeNull();
	return { cards, track };
};

/** Wide screens: the cards also fill the column's width, not half of it. */
const expectCardsFillTheWidth = async (canvasElement: HTMLElement) => {
	const { cards, track } = await expectCardsUseTheRoom(canvasElement);
	const used = cards[2].right - cards[0].left;
	expect(used / track.width).toBeGreaterThan(0.9);
};

export const ReadyQhd2560: StoryObj = {
	name: '4 — Alles geladen (großer Bildschirm 2560)',
	globals: { viewport: { value: 'desktop2560' } },
	render: () => <Waiting finished={HANDOVER_MILESTONES.length} />,
	play: async ({ canvasElement }) => {
		await expectCardsFillTheWidth(canvasElement);
	}
};

export const Ready4k3840: StoryObj = {
	name: '4 — Alles geladen (4K-Bildschirm 3840)',
	globals: { viewport: { value: 'desktop3840' } },
	render: () => <Waiting finished={HANDOVER_MILESTONES.length} />,
	play: async ({ canvasElement }) => {
		await expectCardsFillTheWidth(canvasElement);
	}
};

/** A 1366×768 laptop: the cards shrink so all three fit above the bar. */
export const ReadyLaptop1366: StoryObj = {
	name: '4 — Alles geladen (Laptop 1366×768)',
	globals: { viewport: { value: 'desktop1366' } },
	render: () => <Waiting finished={HANDOVER_MILESTONES.length} />,
	play: async ({ canvasElement }) => {
		await expectCardsUseTheRoom(canvasElement);
	}
};

/** 1920×1080 at 150 % browser zoom: the same, with less room still. */
export const ReadyZoom150: StoryObj = {
	name: '4 — Alles geladen (1920 bei 150 % Zoom)',
	globals: { viewport: { value: 'desktop1280x720' } },
	render: () => <Waiting finished={HANDOVER_MILESTONES.length} />,
	play: async ({ canvasElement }) => {
		await expectCardsUseTheRoom(canvasElement);
	}
};

/**
 * Hover arrows (Frank, 2026-11-11): with a mouse and no trackpad the cards
 * could not be moved to the right. Hover near the right edge of the cards:
 * a strip with a round arrow fades in, a click moves one card, and then the
 * same appears on the left edge. Phones and tablets never show them.
 *
 * Shown in a 390 px window with a mouse: from `sm` up the fluid cards fit
 * side by side (2026-11-13), so there is nothing to scroll and no arrow.
 */
export const ReadyHoverArrows: StoryObj = {
	name: '4c — Pfeile beim Darüberfahren (schmales Fenster, Maus)',
	globals: phone390Globals,
	render: () => <Waiting finished={HANDOVER_MILESTONES.length} />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement, { cards: true });
		await expectArrowStepsOneCard(
			canvasElement,
			'handover-carousel',
			'handover-carousel-arrows'
		);
		await revealHoverArrow(
			canvasElement,
			'start',
			'handover-carousel-arrows'
		);
	}
};

export const GroupInvitationHoverArrows: StoryObj = {
	name: 'Gruppen-Einladung: Pfeile beim Darüberfahren',
	globals: phone390Globals,
	render: () => <GroupJoin />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await revealHoverArrow(
			canvasElement,
			'end',
			'handover-carousel-arrows'
		);
	}
};
