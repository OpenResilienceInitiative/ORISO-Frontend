import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { DragHandle } from './DragHandle';
import { getComposerHeightBounds, stepComposerHeight } from './composerResize';
import '../messageSubmitInterface.styles.scss';

const meta = {
	title: 'Components/Composer/DragHandle',
	component: DragHandle,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Composer drag handle (Figma 1168:38118): 57×4 pill on the outer container ' +
					'edge. Drag or use Arrow keys (Shift for large steps, Home/End for min/max) ' +
					'to resize the composer up to two thirds of the viewport height.'
			}
		}
	},
	decorators: [
		(Story) => (
			<div
				style={{
					position: 'relative',
					height: 64,
					width: 420,
					background: '#fff',
					border: '1px solid var(--m3-primary-fixed, #ffdad5)',
					borderRadius: '24px 4px 24px 24px'
				}}
			>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof DragHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
	args: { ariaLabel: 'Drag to resize composer' }
};

export const Touched: Story = {
	args: { ariaLabel: 'Drag to resize composer', touched: true }
};

/** T31: the phone placement — the pill centred on the card's top edge. */
export const OnTheEdge: Story = {
	name: 'On the edge (phone placement, T31)',
	args: { ariaLabel: 'Drag to resize composer', position: 'edge' },
	play: async ({ canvasElement }) => {
		const handle = canvasElement.querySelector<HTMLElement>('.dragHandle')!;
		const card = handle.parentElement!;
		const pill = handle
			.querySelector('.dragHandle__pill')!
			.getBoundingClientRect();
		await expect(handle).toHaveAttribute('data-position', 'edge');
		await expect(
			Math.abs(
				(pill.top + pill.bottom) / 2 - card.getBoundingClientRect().top
			)
		).toBeLessThanOrEqual(1);
	}
};

function KeyboardResizeDemo() {
	const bounds = getComposerHeightBounds({
		viewportWidth: 1280,
		viewportHeight: 900
	});
	const [height, setHeight] = useState(bounds.minHeight);
	return (
		<>
			<DragHandle
				ariaLabel="Drag to resize composer"
				onKeyDown={(e) => {
					const next = stepComposerHeight(
						height,
						{ key: e.key, shiftKey: e.shiftKey },
						bounds
					);
					if (next !== null) {
						e.preventDefault();
						setHeight(next);
					}
				}}
			/>
			<output
				data-testid="height-readout"
				style={{
					position: 'absolute',
					bottom: 8,
					left: 16,
					font: '13px system-ui'
				}}
			>
				{height}px (max {bounds.maxHeight}px = ⅔ viewport)
			</output>
		</>
	);
}

export const KeyboardResize: Story = {
	args: { ariaLabel: 'Drag to resize composer' },
	render: () => <KeyboardResizeDemo />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const handle = await canvas.findByRole('button');
		handle.focus();

		// End jumps to the two-thirds maximum and must clamp there.
		handle.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'End', bubbles: true })
		);
		await waitFor(async () => {
			await expect(
				canvas.getByTestId('height-readout').textContent
			).toContain('600px');
		});

		handle.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
		);
		await waitFor(async () => {
			await expect(
				canvas.getByTestId('height-readout').textContent
			).toContain('600px');
		});
	}
};

/**
 * T50 (Frank, 06.09.): while a composer is focused ("selected") its field
 * wears the 2 px `primary-container` border (#597) — and the pill on its
 * edge takes THAT colour instead of staying the pale `primary-fixed-dim`
 * on an active field.
 *
 * The rule lives in `dragHandle.styles.scss`
 * (`.textarea__wrapper-send-message--selected .dragHandle__pill`), so all it
 * needs is the composer shell around it. Until now the state was only
 * visible in `Templates/ConsultantSessionStage` "(a4)" at 1440 px — two
 * levels away from the atom it belongs to.
 */
export const OnAFocusedComposer: Story = {
	name: 'Focused composer — pill in the active border colour (T50)',
	args: { ariaLabel: 'Drag to resize composer' },
	render: (args) => (
		<div className="session" style={{ position: 'absolute', inset: 0 }}>
			<div
				className="textarea__wrapper-send-message textarea__wrapper-send-message--selected"
				style={{ position: 'absolute', inset: 0 }}
				data-cy="selected-composer"
			>
				<div
					className="textarea__input"
					style={{ position: 'absolute', inset: 0, borderRadius: 24 }}
				/>
				<DragHandle {...args} />
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const pill =
			canvasElement.querySelector<HTMLElement>('.dragHandle__pill')!;
		const field =
			canvasElement.querySelector<HTMLElement>('.textarea__input')!;
		const root = getComputedStyle(document.documentElement);
		const toRgb = (hex: string) => {
			const n = Number.parseInt(hex.trim().replace('#', ''), 16);
			return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
		};
		const active = toRgb(root.getPropertyValue('--m3-primary-container'));
		const pale = toRgb(root.getPropertyValue('--m3-primary-fixed-dim'));
		await expect(active).not.toBe(pale);
		// The field really is in its selected state (#597: 2 px border) …
		await expect(getComputedStyle(field).borderTopWidth).toBe('2px');
		await expect(getComputedStyle(field).borderTopColor).toBe(active);
		// … and the pill wears the same colour, not the pale one (the
		// surface fades in over 150 ms).
		await waitFor(async () => {
			await expect(getComputedStyle(pill).backgroundColor).toBe(active);
		});
		await expect(getComputedStyle(pill).backgroundColor).not.toBe(pale);
	}
};

/** For comparison: the same pill on a resting composer stays pale. */
export const OnARestingComposer: Story = {
	name: 'Resting composer — pill stays pale (T50 counter-check)',
	args: { ariaLabel: 'Drag to resize composer' },
	render: (args) => (
		<div className="session" style={{ position: 'absolute', inset: 0 }}>
			<div
				className="textarea__wrapper-send-message"
				style={{ position: 'absolute', inset: 0 }}
				data-cy="resting-composer"
			>
				<div
					className="textarea__input"
					style={{ position: 'absolute', inset: 0, borderRadius: 24 }}
				/>
				<DragHandle {...args} />
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const pill =
			canvasElement.querySelector<HTMLElement>('.dragHandle__pill')!;
		const root = getComputedStyle(document.documentElement);
		const toRgb = (hex: string) => {
			const n = Number.parseInt(hex.trim().replace('#', ''), 16);
			return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
		};
		await expect(getComputedStyle(pill).backgroundColor).toBe(
			toRgb(root.getPropertyValue('--m3-primary-fixed-dim'))
		);
	}
};
