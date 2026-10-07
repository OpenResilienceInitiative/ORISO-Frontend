import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { ConsultantSearchLoader } from './ConsultantSearchLoader';
import { ChatroomMainInteractionIcon } from './ChatroomMainInteractionIcon';
import './sessionHeader.styles.scss';

const FIGMA_ROOM_HEADER =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=1320-38281';

/**
 * One drawing, two states: at rest the enquiry glyph, sweeping the search indicator
 * whose beam leaves its container (FE#1115).
 */
const meta = {
	title: 'Components/Session/ConsultantSearchLoader',
	component: ConsultantSearchLoader,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		design: {
			type: 'figma',
			name: 'Room Header All (1320:38281)',
			url: FIGMA_ROOM_HEADER
		},
		docs: {
			description: {
				component:
					'One `size` prop drives the whole drawing. The layout box is exactly `size`; the beam overflows it and never takes part in layout, so nothing moves when the search ends.'
			}
		}
	},
	args: { size: '24px', animated: true }
} satisfies Meta<typeof ConsultantSearchLoader>;

export default meta;
type Story = StoryObj<typeof meta>;

const Plate: React.FC<{
	label: string;
	note?: string;
	dark?: boolean;
	children: React.ReactNode;
}> = ({ label, note, dark, children }) => (
	<div
		style={{
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			gap: 14,
			padding: '34px 30px 18px',
			background: dark ? '#14181b' : '#ffffff',
			color: dark ? '#e6e9ec' : '#1f2529',
			border: `1px solid ${dark ? '#2a3238' : '#ece7e8'}`,
			borderRadius: 14,
			fontFamily: 'system-ui, sans-serif',
			fontSize: 12,
			minWidth: 170
		}}
	>
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				minHeight: 56
			}}
		>
			{children}
		</div>
		<strong style={{ fontSize: 12 }}>{label}</strong>
		{note && (
			<span
				style={{
					opacity: 0.6,
					textAlign: 'center',
					lineHeight: 1.45
				}}
			>
				{note}
			</span>
		)}
	</div>
);

/** The chat-header capsule, at rest and while searching. */
export const InTheCapsule: Story = {
	name: 'In der Kapsel — Ruhe und Suche',
	render: () => (
		<div style={{ display: 'flex', gap: 20, padding: 20 }}>
			<Plate
				label="Anfrage, in Ruhe"
				note="Der Magnet ist das Gesprächs-Symbol. Er steht still, kein Strahl."
			>
				<ChatroomMainInteractionIcon type="inquiry" />
			</Plate>
			<Plate
				label="Wir suchen eine Beratung"
				note="Derselbe Magnet schwenkt und sendet. Der Strahl verlässt die Kapsel und verblasst erst draußen."
			>
				<ChatroomMainInteractionIcon type="inquiry" isSearching />
			</Plate>
			<Plate
				label="Mit „+“-Knopf"
				note="Die breite Kapsel; der Magnet sitzt unverändert an seinem Platz."
			>
				<ChatroomMainInteractionIcon
					type="inquiry"
					isSearching
					showAddIcon
					addLabel="Fachkraft hinzufügen"
				/>
			</Plate>
		</div>
	)
};

/** Without capsule or background, as in the conversation history at ~40 px. */
export const Naked: Story = {
	name: 'Nackt, ohne Hintergrund (Chat-Historie, 40 px)',
	render: () => (
		<div style={{ display: 'flex', gap: 20, padding: 20 }}>
			<Plate label="40 px, suchend">
				<ConsultantSearchLoader size="40px" />
			</Plate>
			<Plate label="40 px, in Ruhe">
				<ConsultantSearchLoader size="40px" animated={false} />
			</Plate>
			<Plate label="40 px auf dunklem Grund" dark>
				<ConsultantSearchLoader size="40px" />
			</Plate>
			<Plate label="32 px — Sitzungsliste">
				<ConsultantSearchLoader size="32px" />
			</Plate>
		</div>
	)
};

/** The same drawing across the sizes the app uses, plus two for review. */
export const Sizes: Story = {
	name: 'Größen — 24 / 32 / 40 / 96',
	render: () => (
		<div
			style={{
				display: 'flex',
				gap: 20,
				alignItems: 'flex-end',
				padding: 20
			}}
		>
			{[24, 32, 40, 96].map((size) => (
				<Plate key={size} label={`${size} px`}>
					<ConsultantSearchLoader size={`${size}px`} />
				</Plate>
			))}
		</div>
	)
};

/** Proves the geometry contract: fixed box, no clipping, outline horseshoe, beam fades outside. */
export const GeometryContract: Story = {
	name: 'Geometrie-Vertrag (FE#1115)',
	args: { size: '40px' },
	play: async ({ canvasElement }) => {
		const loader = await waitFor(() => {
			const element = canvasElement.querySelector<HTMLElement>(
				'.consultantSearchLoader'
			);
			expect(element).toBeTruthy();
			return element!;
		});

		// 1. The layout box is exactly `size`; the beam is not part of it.
		const box = loader.getBoundingClientRect();
		await expect(Math.round(box.width)).toBe(40);
		await expect(Math.round(box.height)).toBe(40);

		// 2. Nothing clips, all the way up.
		let ancestor: HTMLElement | null = loader;
		while (ancestor && ancestor !== canvasElement) {
			await expect(getComputedStyle(ancestor).overflow).toBe('visible');
			ancestor = ancestor.parentElement;
		}

		// 3. An outlined horseshoe, not a filled bar (which reads as a rectangle at 24 px).
		const magnet = loader.querySelector<HTMLElement>(
			'.consultantSearchLoader__magnet'
		)!;
		const magnetStyle = getComputedStyle(magnet);
		// Open at the pointing end …
		await expect(Number.parseFloat(magnetStyle.borderTopWidth)).toBe(0);
		// … the same thickness on the other three, and nothing filled.
		const thickness = Number.parseFloat(magnetStyle.borderBottomWidth);
		await expect(thickness).toBeGreaterThan(0);
		await expect(Number.parseFloat(magnetStyle.borderLeftWidth)).toBe(
			thickness
		);
		await expect(Number.parseFloat(magnetStyle.borderRightWidth)).toBe(
			thickness
		);
		await expect(magnetStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
		// Only the beam leaves the layout box.
		const magnetBox = magnet.getBoundingClientRect();
		await expect(magnetBox.left).toBeGreaterThanOrEqual(box.left - 0.5);
		await expect(magnetBox.right).toBeLessThanOrEqual(box.right + 0.5);
		await expect(magnetBox.top).toBeGreaterThanOrEqual(box.top - 0.5);
		await expect(magnetBox.bottom).toBeLessThanOrEqual(box.bottom + 0.5);

		// 4. The beam leaves the box at full strength and fades outside it.
		const sweep = loader.querySelector<HTMLElement>(
			'.consultantSearchLoader__sweep'
		)!;
		const beam = loader.querySelector<HTMLElement>(
			'.consultantSearchLoader__beam'
		)!;
		// The pulse is one-shot, so start it here and step frozen animations through it.
		loader.classList.add('consultantSearchLoader--pulsing');
		sweep.getAnimations().forEach((animation) => animation.pause());
		sweep.style.transform = 'rotate(90deg)';
		const flight = Number(
			beam.getAnimations()[0]!.effect!.getTiming().duration
		);
		const at = (fraction: number) => {
			beam.getAnimations().forEach((animation) => {
				animation.pause();
				animation.currentTime = flight * fraction;
			});
			return {
				top: beam.getBoundingClientRect().top,
				right: beam.getBoundingClientRect().right,
				opacity: Number.parseFloat(getComputedStyle(beam).opacity)
			};
		};
		// Leaves the box while still fully opaque …
		const leaving = at(0.55);
		await expect(leaving.right).toBeGreaterThan(box.right);
		await expect(leaving.opacity).toBeGreaterThan(0.85);
		// … and is spent well outside it.
		const spent = at(1);
		await expect(spent.right).toBeGreaterThan(leaving.right);
		await expect(spent.opacity).toBeLessThan(0.1);
		// At rest nothing moves.
		loader.classList.remove('consultantSearchLoader--pulsing');
		await expect(getComputedStyle(beam).animationName).toBe('none');
		await expect(getComputedStyle(sweep).animationName).toBe('none');
		sweep.style.removeProperty('transform');
	}
};

/** Sends once on arrival, then rests: the pulse ends with its own animation. */
export const SendsOnceOnArrival: Story = {
	name: 'Sendet einmal beim Erscheinen, dann Ruhe',
	render: () => <ConsultantSearchLoader size="40px" />,
	play: async ({ canvasElement }) => {
		const loader = canvasElement.querySelector<HTMLElement>(
			'.consultantSearchLoader'
		)!;
		await expect(loader).toHaveClass('consultantSearchLoader--pulsing');
		await waitFor(
			() =>
				expect(loader).not.toHaveClass(
					'consultantSearchLoader--pulsing'
				),
			{ timeout: 4000 }
		);
	}
};
