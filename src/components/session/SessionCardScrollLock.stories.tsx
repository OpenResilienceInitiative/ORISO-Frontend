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
			width: 480,
			...(legacyHidden ? { overflow: 'hidden' } : {})
		}}
	>
		<div className="session__content" style={{ overflow: 'auto' }}>
			Timeline
		</div>
		{/* A control that lies beyond the bottom edge of the card. */}
		<button
			type="button"
			style={{ position: 'absolute', top: 400, left: 16 }}
		>
			Notification choice below the card
		</button>
		<div className="messageSubmit__wrapper">
			<button type="button" data-testid="composer-button">
				Composer
			</button>
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
		const canvas = within(canvasElement);
		const card = canvas.getByTestId('session-card');
		await userEvent.tab();
		expect(
			canvas.getByRole('button', { name: /notification choice/i })
		).toHaveFocus();
		expect(card.scrollTop).toBe(0);
		card.scrollTop = 100;
		expect(card.scrollTop).toBe(0);
		// The composer stays docked at the bottom edge of the card.
		await userEvent.tab();
		const composer = canvas.getByTestId('composer-button');
		expect(composer).toHaveFocus();
		const border = parseFloat(getComputedStyle(card).borderBottomWidth);
		const wrapper = composer.closest('.messageSubmit__wrapper')!;
		expect(
			Math.abs(
				card.getBoundingClientRect().bottom -
					wrapper.getBoundingClientRect().bottom -
					border
			)
		).toBeLessThanOrEqual(1);
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
