import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import './session.styles.scss';
import '../enquiry/enquiry.styles';

/**
 * Regression for ORISO-Frontend#1726: focusing a control that sits below the
 * visible part of the chat card must not scroll the card itself. If it did,
 * header, timeline and composer would shift up and leave a blank strip below
 * the composer. The card uses the real `.session` stylesheet.
 */
const hideEnquiryDecoration = `.enquiry__wrapper::after { display: none; }`;

const Card = ({
	legacyHidden = false,
	host = 'session'
}: {
	legacyHidden?: boolean;
	/** The first-message card (`.enquiry__wrapper`) shares the rule. */
	host?: 'session' | 'enquiry';
}) => (
	<>
		{host === 'enquiry' && <style>{hideEnquiryDecoration}</style>}
		<div
			className={host === 'enquiry' ? 'enquiry__wrapper' : 'session'}
			data-testid="session-card"
			// Restores the old `overflow: hidden` rule, to show the defect.
			style={{
				// The enquiry card paints a decorative circle that makes the
				// contrast of its text undecidable for axe; the layout under test
				// is unaffected by a plain background.
				...(host === 'enquiry'
					? { background: '#fff', isolation: 'isolate' }
					: {}),
				height: 320,
				width: '100%',
				maxWidth: 480,
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
	</>
);

const meta: Meta<typeof Card> = {
	title: 'Components/Chat/Session card scroll lock',
	component: Card,
	parameters: { layout: 'fullscreen' }
};
export default meta;
type Story = StoryObj<typeof Card>;

const focusKeepsCardStill: NonNullable<Story['play']> = async ({
	canvasElement
}) => {
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
};

export const FocusDoesNotScrollTheCard: Story = {
	play: focusKeepsCardStill
};

/** The enquiry card is covered by the same `overflow: clip` rule. */
export const EnquiryCardFocusDoesNotScroll: Story = {
	args: { host: 'enquiry' },
	play: focusKeepsCardStill
};

/** Phone width, the case from #1726: the card fills the narrow screen. */
export const FocusDoesNotScrollTheCardPhone390: Story = {
	globals: { viewport: { value: 'phone390' } },
	play: focusKeepsCardStill
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
