import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
	ButtonGroup,
	BUTTON_GROUP_ALIGNMENTS,
	BUTTON_GROUP_VARIANTS,
	type ButtonGroupAlignment,
	type ButtonGroupVariant
} from './ButtonGroup';
import { CaseHandoverConsentCard } from '../caseHandover/CaseHandoverClientCards';
import {
	MessageStoryShell,
	phone390Globals,
	tablet834Globals
} from '../message/messageStoryShell';
import '../message/message.styles.scss';
import '../caseHandover/caseHandoverClientCards.styles.scss';
import './buttonGroup.styles.scss';

const FIGMA = {
	consent:
		'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=9564-86125&m=dev',
	alignment:
		'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=9564-86390&m=dev',
	stackedOutline:
		'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=61592-12039&m=dev',
	verticalOutline:
		'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=58424-8446&m=dev',
	stackedTonal:
		'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=61592-11878&m=dev',
	verticalTonal:
		'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=58424-8462&m=dev',
	stackedPrimary:
		'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=61592-12083&m=dev'
};

/** The consent pair from App.Oriso 9564-86125, in the shipped German wording. */
const consentItems = [
	{ id: 'bg-approve', label: 'Zugriff freigeben' },
	{ id: 'bg-decline', label: 'Zugriff verweigern' }
];

const fourItems = [
	{ id: 'bg-1', label: 'Zugriff freigeben' },
	{ id: 'bg-2', label: 'Zugriff verweigern' },
	{ id: 'bg-3', label: 'Label' },
	{ id: 'bg-4', label: 'Label' }
];

/**
 * A width-constrained stage. Auto-stacking is a *measured* behaviour, so a
 * story that wants to show it has to put the group in a box that is genuinely
 * too narrow — a screenshot of the component at full manager width proves
 * nothing.
 */
const Box = ({
	width,
	children,
	label
}: {
	width: number | string;
	children: React.ReactNode;
	label?: string;
}) => (
	<div style={{ padding: 16, fontFamily: 'inherit' }}>
		{label && (
			<p
				style={{
					margin: '0 0 8px',
					fontSize: 12,
					letterSpacing: 0.5,
					color: '#444748'
				}}
			>
				{label}
			</p>
		)}
		<div
			style={{
				width,
				maxWidth: '100%',
				padding: 16,
				borderRadius: 12,
				background: 'var(--m3-surface-container-high, #eae7e8)',
				boxSizing: 'border-box'
			}}
		>
			{children}
		</div>
	</div>
);

const meta: Meta<typeof ButtonGroup> = {
	title: 'Design System/ButtonGroup',
	component: ButtonGroup,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: [
			{
				type: 'figma',
				name: 'App.Oriso — consent message (9564-86125)',
				url: FIGMA.consent
			},
			{
				type: 'figma',
				name: 'App.Oriso — alignment modes (9564-86390)',
				url: FIGMA.alignment
			},
			{
				type: 'figma',
				name: 'M3_ORISO — stacked primary (61592-12083)',
				url: FIGMA.stackedPrimary
			},
			{
				type: 'figma',
				name: 'M3_ORISO — stacked tonal (61592-11878)',
				url: FIGMA.stackedTonal
			},
			{
				type: 'figma',
				name: 'M3_ORISO — stacked outline (61592-12039)',
				url: FIGMA.stackedOutline
			},
			{
				type: 'figma',
				name: 'M3_ORISO — vertical outline (58424-8446)',
				url: FIGMA.verticalOutline
			},
			{
				type: 'figma',
				name: 'M3_ORISO — vertical tonal (58424-8462)',
				url: FIGMA.verticalTonal
			}
		],
		docs: {
			description: {
				component: [
					'Design-system button group for question/answer boxes — the reader gets',
					'two or more equally weighted actions, optionally numbered.',
					'',
					'**Alignment.** `stacked`, `horizontal-flex` and `horizontal-scroll` are the',
					'three modes in App.Oriso `9564-86390`. `horizontal-flex` additionally',
					'falls back to `stacked` on its own once the row no longer fits: the group',
					'keeps a hidden, unconstrained copy of the single-line row and compares its',
					'intrinsic width with the space available, via `ResizeObserver`.',
					'Measuring rather than guessing a breakpoint is what makes it survive',
					'translation — "Zugriff verweigern" needs far more room than',
					'"Decline access", and Weblate can change either at any time.',
					'',
					'**Disabled items set the native `disabled` attribute**, so they leave the',
					'tab order instead of only looking greyed out.'
				].join('\n')
			}
		}
	},
	argTypes: {
		variant: { control: 'inline-radio', options: BUTTON_GROUP_VARIANTS },
		alignment: {
			control: 'inline-radio',
			options: BUTTON_GROUP_ALIGNMENTS
		},
		numbered: { control: 'boolean' },
		disableAutoStack: { control: 'boolean' }
	},
	args: {
		items: consentItems,
		variant: 'primary',
		alignment: 'horizontal-flex',
		numbered: true,
		ariaLabel: 'Consent options'
	}
};

export default meta;
type Story = StoryObj<typeof ButtonGroup>;

/* ------------------------------------------------------------------ */
/* variant × alignment matrix                                          */
/* ------------------------------------------------------------------ */

/**
 * One story per variant × alignment, each pointing at the single Figma node it
 * was matched against so a reviewer can diff them one to one.
 */
const matrixStory = (
	variant: ButtonGroupVariant,
	alignment: ButtonGroupAlignment,
	figmaUrl: string
): Story => ({
	name: `${variant} — ${alignment}`,
	parameters: { design: { type: 'figma', url: figmaUrl } },
	args: {
		variant,
		alignment,
		// Four items for the two modes whose point is what happens when the
		// content exceeds the box; the consent pair for the flex row.
		items: alignment === 'horizontal-flex' ? consentItems : fourItems,
		// The scroll mode must be free to overflow, and the explicit stacked
		// and flex modes are being shown as themselves — the measured fallback
		// would hide exactly what each story exists to prove.
		disableAutoStack: true
	},
	render: (args) => (
		<Box width={alignment === 'stacked' ? 372 : 560}>
			<ButtonGroup {...args} />
		</Box>
	)
});

export const PrimaryStacked: Story = matrixStory(
	'primary',
	'stacked',
	FIGMA.stackedPrimary
);

export const PrimaryHorizontalFlex: Story = matrixStory(
	'primary',
	'horizontal-flex',
	FIGMA.consent
);

export const PrimaryHorizontalScroll: Story = matrixStory(
	'primary',
	'horizontal-scroll',
	FIGMA.alignment
);

export const TonalStacked: Story = matrixStory(
	'tonal',
	'stacked',
	FIGMA.stackedTonal
);

export const TonalHorizontalFlex: Story = matrixStory(
	'tonal',
	'horizontal-flex',
	FIGMA.consent
);

export const TonalHorizontalScroll: Story = matrixStory(
	'tonal',
	'horizontal-scroll',
	FIGMA.alignment
);

export const OutlineStacked: Story = matrixStory(
	'outline',
	'stacked',
	FIGMA.stackedOutline
);

export const OutlineHorizontalFlex: Story = matrixStory(
	'outline',
	'horizontal-flex',
	FIGMA.verticalOutline
);

export const OutlineHorizontalScroll: Story = matrixStory(
	'outline',
	'horizontal-scroll',
	FIGMA.alignment
);

/* ------------------------------------------------------------------ */
/* behaviour                                                           */
/* ------------------------------------------------------------------ */

/**
 * The same group, same labels, at two widths. 560px fits the pair on one
 * line; 360px does not, and the group falls back to the stacked shape rather
 * than letting the second button run out of the bubble.
 */
export const AutoStacking: Story = {
	name: 'Auto-stacking — fits vs. must stack',
	parameters: {
		design: { type: 'figma', url: FIGMA.alignment },
		docs: {
			description: {
				story: 'Both groups are configured identically (`alignment="horizontal-flex"`); only the container width differs. Both boxes are capped at the viewport width, so on a phone-sized frame the 560px box is narrower than its name and stacks as well — that is the behaviour, not a mislabel. Use the dedicated phone/tablet stories for the per-viewport evidence.'
			}
		}
	},
	render: (args) => (
		<div data-cy="button-group-auto-stacking">
			<Box
				width={560}
				label="Container 560px — the pair fits on one line"
			>
				<ButtonGroup {...args} />
			</Box>
			<Box
				width={360}
				label="Container 360px — the pair cannot fit, so it stacks"
			>
				<ButtonGroup {...args} />
			</Box>
		</div>
	)
};

/** Phone 390: the bubble is narrow enough that the fallback is the norm. */
export const AutoStackingPhone390: Story = {
	name: 'Auto-stacking — phone 390',
	globals: phone390Globals,
	parameters: { design: { type: 'figma', url: FIGMA.alignment } },
	render: (args) => (
		<Box width="100%" label="390px viewport">
			<ButtonGroup {...args} />
		</Box>
	)
};

/** Tablet 834: the same pair still fits, so no fallback fires. */
export const AutoStackingTablet834: Story = {
	name: 'Auto-stacking — tablet 834',
	globals: tablet834Globals,
	parameters: { design: { type: 'figma', url: FIGMA.alignment } },
	render: (args) => (
		<Box width="100%" label="834px viewport">
			<ButtonGroup {...args} />
		</Box>
	)
};

export const Disabled: Story = {
	name: 'Disabled items (native attribute)',
	args: {
		items: [
			{ id: 'bg-d1', label: 'Zugriff freigeben', disabled: true },
			{ id: 'bg-d2', label: 'Zugriff verweigern', disabled: true }
		]
	},
	render: (args) => (
		<Box
			width={560}
			label="Both items carry the native `disabled` attribute"
		>
			<ButtonGroup {...args} />
		</Box>
	)
};

export const MixedVariants: Story = {
	name: 'Mixed variants — affirmative + tonal',
	parameters: { design: { type: 'figma', url: FIGMA.consent } },
	args: {
		items: [
			{ id: 'bg-m1', label: 'Zugriff freigeben', variant: 'primary' },
			{ id: 'bg-m2', label: 'Zugriff verweigern', variant: 'tonal' }
		]
	},
	render: (args) => (
		<Box width={560} label="Per-item `variant` override">
			<ButtonGroup {...args} />
		</Box>
	)
};

export const WithoutBadges: Story = {
	name: 'Without numbered badges',
	args: { numbered: false },
	render: (args) => (
		<Box width={560}>
			<ButtonGroup {...args} />
		</Box>
	)
};

/* ------------------------------------------------------------------ */
/* in-product usage                                                    */
/* ------------------------------------------------------------------ */

/**
 * The consent message the group was built for — App.Oriso `9564-86125`.
 * Rendering the real `CaseHandoverConsentCard` rather than a mock-up is what
 * makes this story a regression guard for the shipped surface.
 */
export const InChatConsent: Story = {
	name: 'In-chat consent message — desktop',
	parameters: { design: { type: 'figma', url: FIGMA.consent } },
	render: () => (
		<MessageStoryShell>
			<CaseHandoverConsentCard
				onApprove={() => {}}
				onDecline={() => {}}
			/>
		</MessageStoryShell>
	)
};

export const InChatConsentPhone390: Story = {
	name: 'In-chat consent message — phone 390',
	globals: phone390Globals,
	parameters: { design: { type: 'figma', url: FIGMA.consent } },
	render: () => (
		<MessageStoryShell compact>
			<CaseHandoverConsentCard
				onApprove={() => {}}
				onDecline={() => {}}
			/>
		</MessageStoryShell>
	)
};

export const InChatConsentSubmitting: Story = {
	name: 'In-chat consent message — decision in flight',
	parameters: { design: { type: 'figma', url: FIGMA.consent } },
	render: () => (
		<MessageStoryShell>
			<CaseHandoverConsentCard
				isSubmitting
				onApprove={() => {}}
				onDecline={() => {}}
			/>
		</MessageStoryShell>
	)
};
