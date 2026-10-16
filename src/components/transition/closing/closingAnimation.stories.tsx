import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { PostRegistrationHandover } from '../../app/registrationLoader/PostRegistrationHandover';
import { HandoverGateButton } from '../../app/registrationLoader/HandoverGateButton';
import { StageLayout } from '../../stageLayout/StageLayout';
import { AgencySpecificContext } from '../../../globalState';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { GlobalComponentContext } from '../../../globalState/provider/GlobalComponentContext';
import { TenantDataInterface } from '../../../globalState/interfaces';
import { LegalLinksProvider } from '../../../globalState/provider/LegalLinksProvider';
import { Stage } from '../../stage/stage';
import { config } from '../../../resources/scripts/config';
import {
	desktop1440Globals,
	phone390Globals,
	tablet834Globals
} from '../../message/messageStoryShell';
import {
	verifyClosingAnimation,
	verifyClosingSkipped
} from '../../../../.storybook/closingAnimationContractPlay';
import { ClosingFocal } from './closingFocal';
import { ClosingVariant } from './closingVariants';

/**
 * The closing animation is one platform module with three designs; the room
 * only says where the person arrives. These stories render a real waiting room
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
					'Three designs, chosen per tenant for desktop and for mobile in the Admin panel:',
					'',
					'1. **Curtain** — two halves close over the right-hand surface, the stage steps in beside them, and they open again onto the message field.',
					'2. **Circle zoom** — the red grows out of the gate button, then closes into a circle on the focal point, deepening in colour, and is gone.',
					'3. **Slide reveal** — the red area swipes to the right as one piece, a second red layer trails it, and the chat is uncovered.',
					'',
					'Reduced motion skips all three. The person still arrives.'
				].join('\n')
			}
		}
	}
};

export default meta;

type Story = StoryObj;

const CONTRACT = {
	curtain: 'CURTAIN',
	circleZoom: 'CIRCLE_ZOOM',
	slideReveal: 'SLIDE_REVEAL'
} as const;

/** The two fields differ on purpose: a design read from the wrong one fails. */
const OTHER: Record<ClosingVariant, (typeof CONTRACT)[ClosingVariant]> = {
	curtain: 'SLIDE_REVEAL',
	circleZoom: 'CURTAIN',
	slideReveal: 'CIRCLE_ZOOM'
};

const tenantFor = (variant: ClosingVariant, desktop: boolean) =>
	({
		id: 1,
		name: 'Closing animation story',
		theming: {
			closingAnimationDesktop: desktop
				? CONTRACT[variant]
				: OTHER[variant],
			closingAnimationMobile: desktop ? OTHER[variant] : CONTRACT[variant]
		}
	}) as unknown as TenantDataInterface;

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
					Ihr Gespräch
				</Typography>
				<Typography>Schreiben Sie, wenn Sie so weit sind.</Typography>
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

const Room = ({
	variant,
	desktop,
	focal,
	swaps
}: {
	variant: ClosingVariant;
	desktop: boolean;
	focal: ClosingFocal;
	swaps: boolean;
}) => {
	const [arrived, setArrived] = useState(false);
	return (
		<TenantContext.Provider
			value={{
				tenant: tenantFor(variant, desktop),
				setTenant: () => undefined,
				updateTenantSettings: () => undefined
			}}
		>
			<AgencySpecificContext.Provider
				value={{
					specificAgency: null,
					setSpecificAgency: () => undefined
				}}
			>
				<GlobalComponentContext.Provider value={{ Stage }}>
					{!swaps ? (
						<StageLayout
							className="stageLayout--registration"
							showLegalLinks={true}
							showLoginLink={false}
							showRegistrationLink={false}
							stage={
								<Stage hasAnimation={false} isReady={true} />
							}
							mobileHero="bar"
						>
							{/* Nothing takes the person on: the gate has to give
							    them the room back. */}
							<Box sx={{ mt: 'auto', p: 3 }}>
								<HandoverGateButton
									state="ready"
									closing={focal}
									onEnter={() => undefined}
								/>
							</Box>
						</StageLayout>
					) : arrived ? (
						<Destination focal={focal} />
					) : (
						<PostRegistrationHandover
							ready
							// The registration room names no destination of its own:
							// the chat is where it arrives. Only a call has to say so.
							closing={focal === 'call' ? 'call' : undefined}
							onEnter={() => setArrived(true)}
						/>
					)}
				</GlobalComponentContext.Provider>
			</AgencySpecificContext.Provider>
		</TenantContext.Provider>
	);
};

const gateOf = (canvasElement: HTMLElement) => () =>
	canvasElement.ownerDocument.querySelector<HTMLElement>(
		'[data-cy="handover-gate-button"]'
	);

const WIDTH = {
	desktop: { globals: desktop1440Globals, desktop: true },
	tablet: { globals: tablet834Globals, desktop: false },
	phone: { globals: phone390Globals, desktop: false }
} as const;

/* A story per design and width. `play` is the whole contract. */
const closingStory = (
	variant: ClosingVariant,
	width: keyof typeof WIDTH,
	extra: { focal?: ClosingFocal; swaps?: boolean; name: string }
): Story => {
	const focal = extra.focal ?? 'messageField';
	const swaps = extra.swaps ?? true;
	return {
		name: extra.name,
		globals: WIDTH[width].globals,
		render: () => (
			<Room
				variant={variant}
				desktop={WIDTH[width].desktop}
				focal={focal}
				swaps={swaps}
			/>
		),
		play: async ({ canvasElement }) => {
			await verifyClosingAnimation(canvasElement, {
				variant,
				focal,
				swaps,
				width,
				gate: gateOf(canvasElement)
			});
		}
	};
};

/* Press the button yourself. These carry no assertions; the stories below do. */
const tryStory = (
	variant: ClosingVariant,
	width: keyof typeof WIDTH,
	name: string
): Story => ({
	name,
	globals: WIDTH[width].globals,
	render: () => (
		<Room
			variant={variant}
			desktop={WIDTH[width].desktop}
			focal="messageField"
			swaps
		/>
	)
});

export const TryCurtain = tryStory('curtain', 'desktop', 'Try it — curtain');
export const TryCircleZoom = tryStory(
	'circleZoom',
	'desktop',
	'Try it — circle zoom'
);
export const TrySlideReveal = tryStory(
	'slideReveal',
	'desktop',
	'Try it — slide reveal'
);
export const TryCurtainPhone = tryStory(
	'curtain',
	'phone',
	'Try it — curtain, phone'
);
export const TryCircleZoomPhone = tryStory(
	'circleZoom',
	'phone',
	'Try it — circle zoom, phone'
);
export const TrySlideRevealPhone = tryStory(
	'slideReveal',
	'phone',
	'Try it — slide reveal, phone'
);

export const CurtainDesktop = closingStory('curtain', 'desktop', {
	name: 'Curtain — desktop'
});
export const CurtainTablet = closingStory('curtain', 'tablet', {
	name: 'Curtain — tablet'
});
export const CurtainPhone = closingStory('curtain', 'phone', {
	name: 'Curtain — phone'
});

export const CircleZoomDesktop = closingStory('circleZoom', 'desktop', {
	name: 'Circle zoom — desktop'
});
export const CircleZoomTablet = closingStory('circleZoom', 'tablet', {
	name: 'Circle zoom — tablet'
});
export const CircleZoomPhone = closingStory('circleZoom', 'phone', {
	name: 'Circle zoom — phone'
});

export const SlideRevealDesktop = closingStory('slideReveal', 'desktop', {
	name: 'Slide reveal — desktop'
});
export const SlideRevealTablet = closingStory('slideReveal', 'tablet', {
	name: 'Slide reveal — tablet'
});
export const SlideRevealPhone = closingStory('slideReveal', 'phone', {
	name: 'Slide reveal — phone'
});

/* A video call has its own focal point; the same module ends there. */
export const CircleZoomEndsOnTheCall = closingStory('circleZoom', 'desktop', {
	name: 'Circle zoom — ends on the video call',
	focal: 'call'
});
export const SlideRevealEndsOnTheCall = closingStory('slideReveal', 'desktop', {
	name: 'Slide reveal — ends on the video call',
	focal: 'call'
});

/* Nothing takes the person on (the room stays): the gate must be theirs again. */
export const CurtainGivesTheGateBack = closingStory('curtain', 'desktop', {
	name: 'Curtain — gives the gate back when the room stays',
	swaps: false
});
export const CircleZoomGivesTheGateBack = closingStory(
	'circleZoom',
	'desktop',
	{
		name: 'Circle zoom — gives the gate back when the room stays',
		swaps: false
	}
);
export const SlideRevealGivesTheGateBack = closingStory(
	'slideReveal',
	'desktop',
	{
		name: 'Slide reveal — gives the gate back when the room stays',
		swaps: false
	}
);

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
	variant: ClosingVariant,
	width: keyof typeof WIDTH,
	name: string
): Story => ({
	name,
	globals: WIDTH[width].globals,
	beforeEach: forceReducedMotion,
	render: () => (
		<Room
			variant={variant}
			desktop={WIDTH[width].desktop}
			focal="messageField"
			swaps
		/>
	),
	play: async ({ canvasElement }) => {
		await verifyClosingSkipped(canvasElement, {
			gate: gateOf(canvasElement)
		});
	}
});

export const CurtainReducedMotion = reducedMotionStory(
	'curtain',
	'desktop',
	'Reduced motion — curtain is skipped, the person arrives'
);
export const CircleZoomReducedMotionPhone = reducedMotionStory(
	'circleZoom',
	'phone',
	'Reduced motion — circle zoom is skipped on a phone'
);
export const SlideRevealReducedMotion = reducedMotionStory(
	'slideReveal',
	'desktop',
	'Reduced motion — slide reveal is skipped, the person arrives'
);
