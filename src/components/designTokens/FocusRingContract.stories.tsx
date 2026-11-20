/**
 * The keyboard focus ring contract (Frontend#1134, ADR-037).
 *
 * ORISO has ONE focus ring. Its colour, width and offset live in
 * `resources/styles/settings.scss` (`$focus-ring-*`, `$focus-outline`) and in
 * the `control-focus-ring` mixins of `_listItemSelection.scss`. Components use
 * `outline: $focus-outline` or `@include control-focus-ring(...)` and never
 * write their own colour.
 *
 * The play functions below are the guard: they focus real ORISO controls with
 * the keyboard and compare the drawn ring with the generated `--m3-primary`
 * role of the active scheme, and with the 3:1 non-text contrast minimum
 * (WCAG 2.2 SC 1.4.11) against the canvas. A white, blue or
 * `--m3-primary-outline` ring fails them in at least one scheme.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button, BUTTON_TYPES } from '../button/Button';
import { ButtonGroup } from '../buttonGroup/ButtonGroup';
import '../buttonGroup/buttonGroup.styles.scss';
import './focusRingContract.styles.scss';

const RING_WIDTH = '2px';
const MIN_NON_TEXT_CONTRAST = 3;
/** Fail fast: a wrong ring is wrong at once, it does not settle later. */
const WAIT = { timeout: 3000 };

/** Resolve a CSS colour (any syntax) to [r, g, b] through the browser. */
const toRgb = (colour: string, host: HTMLElement): number[] => {
	const probe = document.createElement('span');
	probe.style.color = colour;
	host.appendChild(probe);
	const resolved = getComputedStyle(probe).color;
	probe.remove();
	return (resolved.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
};

const luminance = ([r, g, b]: number[]): number => {
	const channel = (c: number): number => {
		const v = c / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a: number[], b: number[]): number => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

/** Tab until `target` has focus (at most 12 presses). */
const tabTo = async (target: HTMLElement): Promise<void> => {
	for (let i = 0; i < 12 && document.activeElement !== target; i += 1) {
		await userEvent.tab();
	}
	await expect(target).toHaveFocus();
};

const expectContractRing = async (
	target: HTMLElement,
	canvas: HTMLElement
): Promise<void> => {
	await tabTo(target);
	await waitFor(() => {
		const style = getComputedStyle(target);
		expect(style.outlineStyle).toBe('solid');
		expect(style.outlineWidth).toBe(RING_WIDTH);
		expect(toRgb(style.outlineColor, canvas)).toEqual(
			toRgb('var(--m3-primary)', canvas)
		);
	}, WAIT);
	const ring = toRgb(getComputedStyle(target).outlineColor, canvas);
	const surface = toRgb(getComputedStyle(canvas).backgroundColor, canvas);
	await expect(contrast(ring, surface)).toBeGreaterThanOrEqual(
		MIN_NON_TEXT_CONTRAST
	);
};

const Specimen = (): React.ReactElement => (
	<div className="focusRingContract" data-testid="canvas">
		<p className="focusRingContract__lead">
			Press Tab. Every control draws the same ring: the primary role of
			the active scheme, 2 px, outside the control. A control filled with
			the primary colour draws the on-primary ring inside its fill.
		</p>
		<div className="focusRingContract__row">
			<Button
				item={{
					type: BUTTON_TYPES.PRIMARY,
					label: 'Primary button'
				}}
				buttonHandle={() => undefined}
				testingAttribute="ring-primary"
			>
				Primary button
			</Button>
			<Button
				item={{
					type: BUTTON_TYPES.SECONDARY,
					label: 'Secondary button'
				}}
				buttonHandle={() => undefined}
				testingAttribute="ring-secondary"
			>
				Secondary button
			</Button>
		</div>
		<div className="focusRingContract__row">
			<ButtonGroup
				items={[
					{ id: 'ring-group-a', label: 'Freigeben' },
					{ id: 'ring-group-b', label: 'Ablehnen' }
				]}
			/>
		</div>
		<div className="focusRingContract__row">
			<button type="button" className="focusRingContract__control">
				Control (mixin)
			</button>
			<button
				type="button"
				className="focusRingContract__filled"
				aria-label="Send (filled)"
			>
				➤
			</button>
		</div>
	</div>
);

const meta: Meta<typeof Specimen> = {
	title: 'Design Tokens/Focus ring contract',
	component: Specimen,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'One keyboard focus ring for ORISO (Frontend#1134, ADR-037). Colour `--m3-primary` of the active scheme (light 7.7:1, dark 10.9:1 on the page surface), width 2 px, offset 2 px, drawn by `$focus-outline` or `@include control-focus-ring(...)`. On a primary fill use `@include control-focus-ring-on-fill` (on-primary ring inside the fill). Replaced: `$focus-blue` #199fff (2.82:1 on white) and `--m3-primary-outline` (1.98:1 on the dark surface). Exception: the dark video stage of the group call keeps its own white ring.'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof Specimen>;

const play: Story['play'] = async ({ canvasElement }) => {
	const view = within(canvasElement);
	const canvas = view.getByTestId('canvas');
	await expectContractRing(
		view.getByRole('button', { name: 'Primary button' }),
		canvas
	);
	await expectContractRing(
		view.getByRole('button', { name: 'Secondary button' }),
		canvas
	);
	await expectContractRing(
		view.getByRole('button', { name: 'Freigeben' }),
		canvas
	);
	await expectContractRing(
		view.getByRole('button', { name: 'Control (mixin)' }),
		canvas
	);

	const filled = view.getByRole('button', { name: 'Send (filled)' });
	await tabTo(filled);
	await waitFor(() => {
		const style = getComputedStyle(filled);
		expect(style.outlineWidth).toBe(RING_WIDTH);
		expect(toRgb(style.outlineColor, canvas)).toEqual(
			toRgb('var(--m3-on-primary)', canvas)
		);
	}, WAIT);
};

export const Light: Story = { globals: { scheme: 'light' }, play };

export const Dark: Story = { globals: { scheme: 'dark' }, play };

export const Inverted: Story = { globals: { scheme: 'inverted' }, play };
