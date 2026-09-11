import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProductTourAdapter } from './ProductTourAdapter';
import { ProductTourTooltip } from './ProductTourTooltip';
import {
	consultantMailCounsellingTour,
	consultantWalkthroughTour
} from './tourDefinitions';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import type {
	TourDefinition,
	TourEvent,
	TourPlacement,
	TourStep
} from './types';
import './productTour.styles.scss';

const demoTour = (steps: TourStep[]): TourDefinition => ({
	id: 'storybook-demo-tour',
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'walkthrough.title',
	summaryKey: 'walkthrough.subtitle',
	steps
});

const anchoredStep = (placement: TourPlacement): TourStep => ({
	id: `demo-${placement}`,
	target: 'storybook-demo-anchor',
	placement,
	titleKey: 'walkthrough.step.1.title',
	contentKey: 'walkthrough.step.1.intro'
});

const DemoAnchor = () => (
	<div
		data-tour-target="storybook-demo-anchor"
		style={{
			margin: '40vh auto',
			width: 280,
			padding: 16,
			textAlign: 'center',
			border: '1px dashed var(--m3-on-surface-variant, #666)',
			borderRadius: 8
		}}
	>
		Demo target element
	</div>
);

const EventLog = ({
	events
}: {
	events: Array<{ event: TourEvent; stepId?: string }>;
}) => (
	<section
		aria-label="Tour event log"
		style={{
			position: 'fixed',
			right: 8,
			bottom: 8,
			maxWidth: 320,
			padding: 8,
			fontSize: 12,
			background: 'var(--m3-surface, #fff)',
			border: '1px solid var(--m3-on-surface-variant, #666)',
			borderRadius: 8,
			zIndex: 100
		}}
	>
		<strong>Events</strong>
		<ol style={{ margin: 4, paddingLeft: 18 }}>
			{events.map((entry, i) => (
				<li key={i}>
					{entry.event}
					{entry.stepId ? ` (${entry.stepId})` : ''}
				</li>
			))}
		</ol>
	</section>
);

const TourPlayground = ({
	tour,
	paused = false,
	targetTimeoutMs = 2500,
	children
}: React.PropsWithChildren<{
	tour: TourDefinition;
	paused?: boolean;
	targetTimeoutMs?: number;
}>) => {
	const [events, setEvents] = useState<
		Array<{ event: TourEvent; stepId?: string }>
	>([]);
	return (
		<div style={{ minHeight: '100vh' }}>
			{children}
			<EventLog events={events} />
			<ProductTourAdapter
				tour={tour}
				active={true}
				paused={paused}
				targetTimeoutMs={targetTimeoutMs}
				tooltipComponent={ProductTourTooltip}
				onEvent={(event, step) =>
					setEvents((prev) => [...prev, { event, stepId: step?.id }])
				}
				onTerminalStatus={() => {}}
			/>
		</div>
	);
};

const meta = {
	title: 'Organisms/ProductTour',
	component: ProductTourAdapter,
	tags: ['autodocs'],
	parameters: {
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'Controlled React Joyride adapter for the ORISO product-tour contract: route-spanning steps, bounded target waiting, domain events and the Frontend tooltip. The event log panel shows the emitted TourEvents live.'
			}
		},
		// The Joyride overlay intentionally dims the page, so contrast is
		// only meaningful inside the tooltip surface itself.
		a11y: {
			config: {
				rules: [
					{
						id: 'color-contrast',
						selector: '.productTourTooltip, .productTourTooltip *'
					}
				]
			}
		}
	},
	// Every story renders through TourPlayground; these args only satisfy the
	// component's required props for Storybook's type-level args contract.
	args: {
		tour: consultantWalkthroughTour,
		active: true
	}
} satisfies Meta<typeof ProductTourAdapter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CenteredIntroduction: Story = {
	render: () => (
		<TourPlayground
			tour={demoTour([
				{
					id: 'intro',
					target: '',
					placement: 'center',
					titleKey: 'walkthrough.step.0.title',
					contentKey: 'walkthrough.step.0.intro'
				}
			])}
		/>
	)
};

export const PlacementTop: Story = {
	render: () => (
		<TourPlayground tour={demoTour([anchoredStep('top')])}>
			<DemoAnchor />
		</TourPlayground>
	)
};

export const PlacementBottom: Story = {
	render: () => (
		<TourPlayground tour={demoTour([anchoredStep('bottom')])}>
			<DemoAnchor />
		</TourPlayground>
	)
};

export const PlacementLeft: Story = {
	render: () => (
		<TourPlayground tour={demoTour([anchoredStep('left')])}>
			<DemoAnchor />
		</TourPlayground>
	)
};

export const PlacementRight: Story = {
	render: () => (
		<TourPlayground tour={demoTour([anchoredStep('right')])}>
			<DemoAnchor />
		</TourPlayground>
	)
};

export const MissingTarget: Story = {
	render: () => (
		<TourPlayground
			targetTimeoutMs={800}
			tour={demoTour([
				{
					id: 'intro',
					target: '',
					placement: 'center',
					titleKey: 'walkthrough.step.0.title',
					contentKey: 'walkthrough.step.0.intro'
				},
				{
					id: 'ghost',
					target: 'does-not-exist',
					titleKey: 'walkthrough.step.1.title',
					contentKey: 'walkthrough.step.1.intro'
				},
				anchoredStep('bottom')
			])}
		>
			<DemoAnchor />
		</TourPlayground>
	),
	parameters: {
		docs: {
			description: {
				story: "Click next on the intro: the second step's target never appears, so after the bounded wait a target_missing event is logged and the tour continues safely on the third step."
			}
		}
	}
};

export const PendingNavigation: Story = {
	render: () => {
		const LateAnchor = () => {
			const [visible, setVisible] = useState(false);
			React.useEffect(() => {
				const timer = setTimeout(() => setVisible(true), 1500);
				return () => clearTimeout(timer);
			}, []);
			return visible ? <DemoAnchor /> : null;
		};
		return (
			<TourPlayground
				tour={demoTour([
					{
						id: 'intro',
						target: '',
						placement: 'center',
						titleKey: 'walkthrough.step.0.title',
						contentKey: 'walkthrough.step.0.intro'
					},
					anchoredStep('bottom')
				])}
			>
				<LateAnchor />
			</TourPlayground>
		);
	},
	parameters: {
		docs: {
			description: {
				story: "The second step's target mounts 1.5s late (simulating route navigation): after next, the tour stays on the intro until the target is ready, then advances — the adapter never positions against a missing element."
			}
		}
	}
};

export const PausedByBlockingDialog: Story = {
	render: () => (
		<TourPlayground paused={true} tour={demoTour([anchoredStep('bottom')])}>
			<DemoAnchor />
			<div
				role="dialog"
				aria-label="Blocking dialog placeholder"
				style={{
					position: 'fixed',
					inset: '30% 25%',
					background: 'var(--m3-surface, #fff)',
					border: '2px solid var(--m3-primary, #a5000a)',
					borderRadius: 8,
					display: 'grid',
					placeItems: 'center',
					zIndex: 60
				}}
			>
				A higher-priority dialog (e.g. 2FA) pauses the tour.
			</div>
		</TourPlayground>
	)
};

export const CompoundConsultantWalkthrough: Story = {
	render: () => (
		<TourPlayground tour={consultantWalkthroughTour} targetTimeoutMs={4000}>
			<div
				style={{
					display: 'grid',
					gap: 24,
					padding: 24,
					gridTemplateColumns: '280px 1fr'
				}}
			>
				<div
					data-tour-target="consultant-enquiries-list"
					style={{
						border: '1px solid #ccc',
						borderRadius: 8,
						padding: 12
					}}
				>
					<span data-tour-target="sessions-archive-tab">
						Archiv-Chip
					</span>
					<p>Mock Anfragen-/Gesprächsliste</p>
					<div data-tour-target="consultant-sessions-list">
						Meine Beratungen
					</div>
				</div>
				<div
					data-tour-target="profile-overview"
					style={{
						border: '1px solid #ccc',
						borderRadius: 8,
						padding: 12
					}}
				>
					Mock Profilbereich
				</div>
			</div>
		</TourPlayground>
	),
	parameters: {
		docs: {
			description: {
				story: 'The migrated five-step consultant walkthrough as a controlled compound story: all real tour definitions, semantic targets mocked in place. Route navigation is exercised for real in the running app (Playwright regression).'
			}
		}
	}
};

export const CompoundMailCounsellingTour: Story = {
	render: () => (
		<TourPlayground
			tour={consultantMailCounsellingTour}
			targetTimeoutMs={4000}
		>
			<div
				style={{
					display: 'grid',
					gap: 24,
					padding: 24,
					gridTemplateColumns: '280px 1fr'
				}}
			>
				<div
					data-tour-target="consultant-enquiries-list"
					style={{
						border: '1px solid #ccc',
						borderRadius: 8,
						padding: 12
					}}
				>
					<span data-tour-target="sessions-archive-tab">
						Archiv-Chip
					</span>
					<p>Mock Anfragen-/Gesprächsliste</p>
					<div data-tour-target="consultant-sessions-list">
						Meine Beratungen
					</div>
				</div>
				<div
					data-tour-target="session-composer"
					style={{
						border: '1px solid #ccc',
						borderRadius: 8,
						padding: 12,
						alignSelf: 'end'
					}}
				>
					Mock Composer (Threads, Sprachnachricht, Anhänge)
				</div>
			</div>
		</TourPlayground>
	),
	parameters: {
		docs: {
			description: {
				story: 'TOUR-10: the six-step Mail-Beratung tour for consultants migrating from the legacy platform, difference-first copy. The composer step is optional — in the real app it is skipped silently when no session is open, and the tour still completes.'
			}
		}
	}
};
