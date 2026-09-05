import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import { DefaultActionBar } from './DefaultActionBar';
import { phone390Globals } from '../../message/messageStoryShell';

const ACTION_BAR_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=7104-34790';

/**
 * The compact bar inside the composer card: the strip sits 8 px from the
 * left and keeps 72 px clear of the send button on the right — at 390 the
 * bar is ~278 px wide and the seven icons (40 px each) do not fit.
 */
function BarHarness({
	width,
	phone = false
}: {
	width: number;
	phone?: boolean;
}) {
	const { t } = useTranslation();
	return (
		<div
			style={{
				position: 'relative',
				width,
				height: 104,
				boxSizing: 'border-box',
				background: 'var(--m3-surface-container-lowest, #fff)',
				border: '1px solid var(--m3-primary-fixed-dim, #ffb4aa)',
				borderRadius: '24px 4px 24px 24px'
			}}
		>
			<div style={{ position: 'absolute', top: 4, left: 8, right: 72 }}>
				<DefaultActionBar
					showBack={phone}
					onBack={() => {}}
					onScrollToNewest={() => {}}
					unreadCount={3}
					onOpenTools={() => {}}
					showMic
					isRecording={false}
					onMicClick={() => {}}
					isEmojiOpen={false}
					onEmojiClick={() => {}}
					onMentionClick={() => {}}
					showAttachment
					onAttachmentClick={() => {}}
					isExpanded={false}
					onExpandToggle={() => {}}
					translate={t}
				/>
			</div>
			<div
				aria-hidden="true"
				style={{
					position: 'absolute',
					top: 0,
					right: 0,
					width: 48,
					height: 48,
					borderRadius: '0 4px 0 24px',
					background: 'var(--m3-primary-fixed-dim, #ffb4aa)'
				}}
			/>
		</div>
	);
}

const meta = {
	title: 'Components/Composer/ActionBar',
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		design: { type: 'figma', url: ACTION_BAR_FIGMA_URL },
		docs: {
			description: {
				component:
					'Compact action bar of the composer (Figma 7104:34790). The row scrolls sideways when it does not fit (T22): ' +
					'the hidden edge fades, resting positions land on whole icons, and a mouse wheel travels along the row (review v6).'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const bar = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLElement>(
		'[data-cy="composer-action-bar"]'
	)!;

export const Desktop: Story = {
	name: 'Desktop — fits, no fade',
	render: () => <BarHarness width={640} />,
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			expect(bar(canvasElement).dataset.overflowEnd).toBe('false');
			expect(bar(canvasElement).dataset.overflowStart).toBe('false');
		});
		await expect(getComputedStyle(bar(canvasElement)).maskImage).toBe(
			'none'
		);
	}
};

/**
 * Review v6 (T22): on the phone the bar overflows — the end fades, the
 * wheel scrolls it, and scrolled to the end the last icon is whole.
 */
export const Phone390Scrolls: Story = {
	name: 'Phone 390 — bar scrolls: fade at the end, wheel travels, last icon whole (review v6)',
	globals: phone390Globals,
	render: () => <BarHarness width={358} phone />,
	play: async ({ canvasElement }) => {
		const element = bar(canvasElement);
		await waitFor(() => {
			expect(element.scrollWidth).toBeGreaterThan(element.clientWidth);
			expect(element.dataset.overflowEnd).toBe('true');
			expect(element.dataset.overflowStart).toBe('false');
		});
		await expect(getComputedStyle(element).maskImage).not.toBe('none');

		// A mouse's vertical wheel travels along the row (no Shift needed).
		element.dispatchEvent(
			new WheelEvent('wheel', {
				deltaY: 60,
				deltaX: 0,
				bubbles: true,
				cancelable: true
			})
		);
		await waitFor(() => {
			expect(element.scrollLeft).toBeGreaterThan(0);
			expect(element.dataset.overflowStart).toBe('true');
		});

		// Scrolled to the end: the fade moves to the start, the last icon is
		// entirely inside the bar.
		element.scrollLeft = element.scrollWidth;
		await waitFor(() => {
			expect(element.dataset.overflowEnd).toBe('false');
			expect(element.dataset.overflowStart).toBe('true');
		});
		const buttons = element.querySelectorAll('button');
		const last = buttons[buttons.length - 1].getBoundingClientRect();
		const box = element.getBoundingClientRect();
		await expect(last.right).toBeLessThanOrEqual(box.right + 1);
		await expect(last.left).toBeGreaterThanOrEqual(box.left - 1);
		// The bar ends at the send button's inset, not underneath it.
		const shell = element.closest<HTMLElement>('[style*="border-radius"]')!;
		await expect(box.right).toBeLessThanOrEqual(
			shell.getBoundingClientRect().right - 72 + 1
		);
	}
};
