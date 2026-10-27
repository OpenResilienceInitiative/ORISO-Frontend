import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import './session.styles.scss';

/**
 * Regression for ORISO-Frontend#1726: focusing a control that sits below the
 * visible part of the chat card must not scroll the card itself. If it did,
 * header, timeline and composer would shift up and leave a blank strip below
 * the composer. The card uses the real `.session` stylesheet.
 */
const Card = ({ legacyHidden = false }: { legacyHidden?: boolean }) => (
	<div
		className="session"
		data-testid="session-card"
		// Restores the old `overflow: hidden` rule, to show the defect.
		style={{
			height: 320,
			maxWidth: 480,
			...(legacyHidden ? { overflow: 'hidden' } : {})
		}}
	>
		<div style={{ flex: 'none', height: 400, padding: 16 }}>Timeline</div>
		<div style={{ flex: 'none', height: 160, padding: 16 }}>
			<button type="button">Composer action below the fold</button>
		</div>
	</div>
);

const meta: Meta<typeof Card> = {
	title: 'Components/Chat/Session card scroll lock',
	component: Card,
	parameters: { layout: 'centered' }
};
export default meta;
type Story = StoryObj<typeof Card>;

export const FocusDoesNotScrollTheCard: Story = {
	play: async ({ canvasElement }) => {
		const card = within(canvasElement).getByTestId('session-card');
		await userEvent.tab();
		expect(
			within(card).getByRole('button', {
				name: /composer action below the fold/i
			})
		).toHaveFocus();
		expect(card.scrollTop).toBe(0);
		card.scrollTop = 100;
		expect(card.scrollTop).toBe(0);
	}
};

/** The defect before the fix: `overflow: hidden` lets focus scroll the card. */
export const BeforeFixHiddenScrollsOnFocus: Story = {
	args: { legacyHidden: true },
	play: async ({ canvasElement }) => {
		const card = within(canvasElement).getByTestId('session-card');
		await userEvent.tab();
		expect(card.scrollTop).toBeGreaterThan(0);
	}
};
