import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { PostRegistrationHandover } from '../../app/registrationLoader/PostRegistrationHandover';
import { AgencySpecificContext } from '../../../globalState';
import { GlobalComponentContext } from '../../../globalState/provider/GlobalComponentContext';
import { LegalLinksProvider } from '../../../globalState/provider/LegalLinksProvider';
import { Stage } from '../../stage/stage';
import { config } from '../../../resources/scripts/config';
import {
	desktop1440Globals,
	phone390Globals,
	tablet834Globals
} from '../../message/messageStoryShell';
import {
	expectWaitingRoomTemplate,
	verifyClosingAnimation,
	verifyClosingSkipped
} from '../../../../.storybook/closingAnimationContractPlay';
import { expectWaitingRoomLayout } from '../../app/registrationLoader/waitingRoomLayoutContract';
import { ClosingFocal } from './closingFocal';

/**
 * The closing animation is one platform module with one design, the slide
 * reveal; the room only says where the person arrives. These stories render a real waiting room
 * (the handover after registering, in the split layout with the brand stage) and
 * press its real gate button. Every story shows a destination that has the
 * focal element the animation must end on.
 */
const meta: Meta = {
	id: 'transition-closing-animation',
	title: 'Entry flows/Closing animation',
	decorators: [
		(Story) => (
			<LegalLinksProvider legalLinks={config.legalLinks}>
				<Story />
			</LegalLinksProvider>
		)
	],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component: [
					'One design, the **slide reveal**: the red area swipes over the room as one piece, a second red layer trails it, and the chat is uncovered.',
					'',
					'It sweeps **sideways** (to the right) on a desktop width, where the room stands beside the brand stage, and **upward** on a phone or a tablet, where the screen is one column. The line is 1200 px.',
					'',
					'Reduced motion skips it. The person still arrives.',
					'',
					'The room the person arrives in ("Chat — Platzhalter") is a stand-in for these stories only; the product shows the real chat there.'
				].join('\n')
			}
		}
	}
};

export default meta;

type Story = StoryObj;

const Destination = ({ focal }: { focal: ClosingFocal }) =>
	focal === 'call' ? (
		<Box
			sx={{
				minHeight: '100vh',
				display: 'grid',
				placeItems: 'center',
				bgcolor: '#14171a',
				color: '#fff'
			}}
		>
			<Box
				data-closing-focal="call"
				role="img"
				aria-label="Videoanruf"
				sx={{
					width: 'min(480px, 86vw)',
					height: 280,
					borderRadius: 3,
					bgcolor: '#2a2f35',
					display: 'grid',
					placeItems: 'center'
				}}
			>
				<Typography>Videoanruf</Typography>
			</Box>
		</Box>
	) : (
		<Box
			sx={{
				minHeight: '100vh',
				display: 'flex',
				flexDirection: 'column',
				bgcolor: '#fcf9f9',
				color: '#1b1b1c'
			}}
		>
			<Box sx={{ flex: 1, p: 3 }}>
				<Typography variant="h6" component="h1">
					Chat — Platzhalter
				</Typography>
				<Typography>
					Nur für diese Stories: Hier steht im Produkt der echte Chat.
				</Typography>
			</Box>
			<Box sx={{ p: 2, borderTop: '1px solid #747878' }}>
				<Box
					data-closing-focal="message-field"
					sx={{ border: '1px solid #747878', borderRadius: 2, p: 1 }}
				>
					<label>
						<Box component="span" sx={{ display: 'none' }}>
							Nachricht
						</Box>
						<Box
							component="textarea"
							aria-label="Nachricht schreiben"
							rows={2}
							sx={{ width: '100%', border: 0, font: 'inherit' }}
						/>
					</label>
				</Box>
			</Box>
		</Box>
	);

const Room = ({ focal, swaps }: { focal: ClosingFocal; swaps: boolean }) => {
	const [arrived, setArrived] = useState(false);
	return (
		<>
			<AgencySpecificContext.Provider
				value={{
					specificAgency: null,
					setSpecificAgency: () => undefined
				}}
			>
				<GlobalComponentContext.Provider value={{ Stage }}>
					{arrived ? (
						<Destination focal={focal} />
					) : (
						// The real waiting room (frame, template, bar, gate), never a
						// hand-laid one. When nothing takes the person on, the gate has
						// to give them the room back: a room that refuses or fails to
						// take them on stays as it was, so its gate stays `ready`.
						<PostRegistrationHandover
							ready
							forcedState={swaps ? undefined : 'ready'}
							// The registration room names no destination of its own:
							// the chat is where it arrives. Only a call has to say so.
							closing={focal === 'call' ? 'call' : undefined}
							onEnter={
								swaps ? () => setArrived(true) : () => undefined
							}
						/>
					)}
				</GlobalComponentContext.Provider>
			</AgencySpecificContext.Provider>
		</>
	);
};

const gateOf = (canvasElement: HTMLElement) => () =>
	canvasElement.ownerDocument.querySelector<HTMLElement>(
		'[data-cy="handover-gate-button"]'
	);

/* Sideways beside the brand stage, upward on one column. */
const WIDTH = {
	desktop: { globals: desktop1440Globals, direction: 'horizontal' },
	tablet: { globals: tablet834Globals, direction: 'vertical' },
	phone: { globals: phone390Globals, direction: 'vertical' }
} as const;

/* A story per width. `play` is the whole contract. */
const closingStory = (
	width: keyof typeof WIDTH,
	extra: { focal?: ClosingFocal; swaps?: boolean; name: string }
): Story => {
	const focal = extra.focal ?? 'messageField';
	const swaps = extra.swaps ?? true;
	return {
		name: extra.name,
		globals: WIDTH[width].globals,
		render: () => <Room focal={focal} swaps={swaps} />,
		play: async ({ canvasElement }) => {
			// The room is a waiting room: its layout holds before it closes.
			await expectWaitingRoomLayout(canvasElement);
			await expectWaitingRoomTemplate(canvasElement);
			await verifyClosingAnimation(canvasElement, {
				direction: WIDTH[width].direction,
				focal,
				swaps,
				width,
				gate: gateOf(canvasElement)
			});
		}
	};
};

/* Press the button yourself. The room's layout is checked; the stories below
   check the animation. */
const tryStory = (width: keyof typeof WIDTH, name: string): Story => ({
	name,
	globals: WIDTH[width].globals,
	render: () => <Room focal="messageField" swaps />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expectWaitingRoomTemplate(canvasElement);
	}
});

export const TrySlideReveal = tryStory(
	'desktop',
	'Try it — slide reveal, sideways'
);
export const TrySlideRevealTablet = tryStory(
	'tablet',
	'Try it — slide reveal, upward, tablet'
);
export const TrySlideRevealPhone = tryStory(
	'phone',
	'Try it — slide reveal, upward, phone'
);

export const SlideRevealDesktop = closingStory('desktop', {
	name: 'Slide reveal — desktop, sideways'
});
export const SlideRevealTablet = closingStory('tablet', {
	name: 'Slide reveal — tablet, upward'
});
export const SlideRevealPhone = closingStory('phone', {
	name: 'Slide reveal — phone, upward'
});

/* A video call has its own focal point; the same module ends there. */
export const SlideRevealEndsOnTheCall = closingStory('desktop', {
	name: 'Slide reveal — ends on the video call',
	focal: 'call'
});
export const SlideRevealEndsOnTheCallPhone = closingStory('phone', {
	name: 'Slide reveal — ends on the video call, phone',
	focal: 'call'
});

/* Nothing takes the person on (the room stays): the gate must be theirs again. */
export const SlideRevealGivesTheGateBack = closingStory('desktop', {
	name: 'Slide reveal — gives the gate back when the room stays',
	swaps: false
});
export const SlideRevealGivesTheGateBackPhone = closingStory('phone', {
	name: 'Slide reveal — gives the gate back when the room stays, phone',
	swaps: false
});

/* Only the reduced-motion question is answered differently, so the real
   matchMedia stays in place for everything else (the stage reads widths). */
const forceReducedMotion = () => {
	const original = window.matchMedia.bind(window);
	window.matchMedia = ((query: string) => {
		const real = original(query);
		if (!query.includes('prefers-reduced-motion')) {
			return real;
		}
		return {
			matches: query.includes('reduce'),
			media: query,
			onchange: null,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
			addListener: () => undefined,
			removeListener: () => undefined,
			dispatchEvent: () => false
		} as MediaQueryList;
	}) as typeof window.matchMedia;
	return () => {
		window.matchMedia = original;
	};
};

const reducedMotionStory = (
	width: keyof typeof WIDTH,
	name: string
): Story => ({
	name,
	globals: WIDTH[width].globals,
	beforeEach: forceReducedMotion,
	render: () => <Room focal="messageField" swaps />,
	play: async ({ canvasElement }) => {
		await expectWaitingRoomLayout(canvasElement);
		await expectWaitingRoomTemplate(canvasElement);
		await verifyClosingSkipped(canvasElement, {
			gate: gateOf(canvasElement)
		});
	}
});

export const SlideRevealReducedMotion = reducedMotionStory(
	'desktop',
	'Reduced motion — slide reveal is skipped, the person arrives'
);
export const SlideRevealReducedMotionPhone = reducedMotionStory(
	'phone',
	'Reduced motion — slide reveal is skipped on a phone'
);
