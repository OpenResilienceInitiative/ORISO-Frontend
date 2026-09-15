import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { ConsultantSearchLoader } from './ConsultantSearchLoader';
import { ChatroomMainInteractionIcon } from './ChatroomMainInteractionIcon';
import './sessionHeader.styles.scss';

const FIGMA_ROOM_HEADER =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=1320-38281';

/**
 * The magnet — one drawing with two states.
 *
 * Standing still it is the conversation-type glyph of an enquiry. Sweeping
 * it is the "we are looking for a counsellor for you" indicator, and its
 * beam leaves whatever container it sits in.
 *
 * FE#1115 replaced two separate hand-built magnets with this one: the
 * capsule used to draw its own (a bar with `border-radius: 6px 0 0 6px`
 * plus two grey stripes out of a gradient), and a second, animated one sat
 * beside it inside a black disc whose `overflow: hidden` cut the beam off
 * at its own edge — so the fade-out never became visible.
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

/**
 * Where it ships: inside the oval capsule of the chat header. Left the
 * enquiry at rest, right the same capsule while the search is running.
 */
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

/**
 * The naked magnet — no capsule, no disc, no background of any kind.
 * This is the variant for the conversation history at ~40 px.
 */
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

/**
 * The geometry contract, asserted rather than eyeballed — this is what
 * FE#1115 actually bought.
 */
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

		// 1. The layout box is exactly `size` — the beam is not part of it,
		//    so replacing the indicator cannot move anything.
		const box = loader.getBoundingClientRect();
		await expect(Math.round(box.width)).toBe(40);
		await expect(Math.round(box.height)).toBe(40);

		// 2. Nothing clips, all the way up.
		let ancestor: HTMLElement | null = loader;
		while (ancestor && ancestor !== canvasElement) {
			await expect(getComputedStyle(ancestor).overflow).toBe('visible');
			ancestor = ancestor.parentElement;
		}

		// 3. It is a horseshoe drawn as an outline, not a filled bar. Both
		//    of the drawings this replaced were bars — a rectangle with
		//    `border-radius: 6px 0 0 6px`, rounded on one side and square on
		//    the other, which is exactly what read as a rectangle at 24 px.
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
		// The drawing itself stays inside the layout box; only the beam
		// leaves it.
		const magnetBox = magnet.getBoundingClientRect();
		await expect(magnetBox.left).toBeGreaterThanOrEqual(box.left - 0.5);
		await expect(magnetBox.right).toBeLessThanOrEqual(box.right + 0.5);
		await expect(magnetBox.top).toBeGreaterThanOrEqual(box.top - 0.5);
		await expect(magnetBox.bottom).toBeLessThanOrEqual(box.bottom + 0.5);

		// 4. The beam is still at full strength when it leaves the box, and
		//    it fades outside it. Both animations are frozen and stepped
		//    through the pulse, so this is measured, not eyeballed.
		const sweep = loader.querySelector<HTMLElement>(
			'.consultantSearchLoader__sweep'
		)!;
		const beam = loader.querySelector<HTMLElement>(
			'.consultantSearchLoader__beam'
		)!;
		sweep.getAnimations().forEach((animation) => animation.pause());
		sweep.style.transform = 'rotate(0deg)';
		const at = (fraction: number) => {
			beam.getAnimations().forEach((animation) => {
				animation.pause();
				animation.currentTime = 4200 * fraction;
			});
			return {
				top: beam.getBoundingClientRect().top,
				opacity: Number.parseFloat(getComputedStyle(beam).opacity)
			};
		};
		// Leaves the box while still fully opaque …
		const leaving = at(0.15);
		await expect(leaving.top).toBeLessThan(box.top);
		await expect(leaving.opacity).toBeGreaterThan(0.85);
		// … and is spent well outside it.
		const spent = at(0.3);
		await expect(spent.top).toBeLessThan(leaving.top);
		await expect(spent.opacity).toBeLessThan(0.1);
		sweep.style.removeProperty('transform');
	}
};
