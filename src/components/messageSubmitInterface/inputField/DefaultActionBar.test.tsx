// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { DefaultActionBar } from './DefaultActionBar';

afterEach(() => cleanup());

const baseProps = {
	onScrollToNewest: vi.fn(),
	onOpenTools: vi.fn(),
	isRecording: false,
	onMicClick: vi.fn(),
	isEmojiOpen: false,
	onEmojiClick: vi.fn(),
	onMentionClick: vi.fn(),
	showAttachment: true,
	onAttachmentClick: vi.fn(),
	isExpanded: false,
	onExpandToggle: vi.fn(),
	translate: ((key: string) => {
		const catalogue: Record<string, string> = {
			'message.submit.toolbar.voiceRecording.label': 'Voice recording',
			'message.submit.toolbar.voiceRecording.tooltip':
				'Record voice message',
			'message.submit.toolbar.attachment': 'Add attachment',
			'message.submit.toolbar.emoji': 'Emoji panel',
			'message.submit.toolbar.mention': 'Mention',
			'message.mobileNav.back': 'Navigate up',
			'message.mobileNav.scrollToBottom': 'Scroll to bottom'
		};
		return catalogue[key] ?? key;
	}) as any
};

describe('DefaultActionBar', () => {
	it('shows the mic when voice messages are enabled', () => {
		render(<DefaultActionBar {...baseProps} showMic />);
		expect(
			screen.getByRole('button', { name: 'Voice recording' })
		).toBeTruthy();
	});

	it('hides the mic entirely when voice messages are disabled', () => {
		render(<DefaultActionBar {...baseProps} showMic={false} />);
		expect(
			screen.queryByRole('button', { name: 'Voice recording' })
		).toBeNull();
	});

	it('hides the attachment button when uploads are unavailable', () => {
		render(
			<DefaultActionBar {...baseProps} showMic showAttachment={false} />
		);
		expect(
			screen.queryByRole('button', { name: 'Add attachment' })
		).toBeNull();
	});

	it('always exposes emoji and mention actions', () => {
		render(<DefaultActionBar {...baseProps} showMic={false} />);
		expect(
			screen.getByRole('button', { name: 'Emoji panel' })
		).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Mention' })).toBeTruthy();
	});

	it('exposes a hover tooltip that names the voice-note action', () => {
		render(<DefaultActionBar {...baseProps} showMic />);
		expect(
			screen
				.getByRole('button', { name: 'Voice recording' })
				.getAttribute('title')
		).toBe('Record voice message');
	});

	it('keeps the mic visible but unavailable, focusable and explained when a reason is given', () => {
		const onMicClick = vi.fn();
		render(
			<DefaultActionBar
				{...baseProps}
				showMic
				onMicClick={onMicClick}
				micUnavailableReason="Not while editing"
			/>
		);
		const mic = screen.getByRole('button', { name: 'Voice recording' });
		expect(mic.getAttribute('aria-disabled')).toBe('true');
		expect((mic as HTMLButtonElement).disabled).toBe(false);
		expect(
			document.getElementById(mic.getAttribute('aria-describedby')!)
				?.textContent
		).toBe('Not while editing');
		mic.focus();
		expect(document.activeElement).toBe(mic);
		fireEvent.click(mic);
		expect(onMicClick).not.toHaveBeenCalled();
	});

	it('shows the unavailable reason visibly when the mic gets keyboard focus, and hides it on blur', async () => {
		const user = userEvent.setup();
		render(
			<DefaultActionBar
				{...baseProps}
				showMic
				micUnavailableReason="Not while editing"
			/>
		);
		const mic = screen.getByRole('button', { name: 'Voice recording' });
		expect(screen.queryByRole('tooltip')).toBeNull();
		for (let i = 0; i < 10 && document.activeElement !== mic; i++) {
			await user.tab();
		}
		expect(document.activeElement).toBe(mic);
		expect((await screen.findByRole('tooltip')).textContent).toBe(
			'Not while editing'
		);
		await user.tab();
		await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
	});

	it('shows the unavailable reason on a touch tap', async () => {
		render(
			<DefaultActionBar
				{...baseProps}
				showMic
				micUnavailableReason="Not while editing"
			/>
		);
		const mic = screen.getByRole('button', { name: 'Voice recording' });
		fireEvent.touchStart(mic);
		expect((await screen.findByRole('tooltip')).textContent).toBe(
			'Not while editing'
		);
	});

	it('keeps the default mic free of a custom tooltip', async () => {
		const user = userEvent.setup();
		render(<DefaultActionBar {...baseProps} showMic />);
		const mic = screen.getByRole('button', { name: 'Voice recording' });
		for (let i = 0; i < 10 && document.activeElement !== mic; i++) {
			await user.tab();
		}
		expect(screen.queryByRole('tooltip')).toBeNull();
	});

	it('puts every compact control on the larger default action bar', () => {
		const { container } = render(
			<DefaultActionBar {...baseProps} showMic />
		);
		expect(
			container.querySelector('.composerToolbar--default')
		).toBeTruthy();
		expect(
			container.querySelector('.composerToolbar__button--voice')
		).toBeNull();
	});

	// T16: the phone's navigator row (◂ ▬ ▾) is gone; its two arrows live
	// at the start of the action bar — back only on the phone, scroll to
	// newest everywhere.
	it('puts the scroll-to-newest arrow first and never shows the back arrow without showBack', () => {
		render(<DefaultActionBar {...baseProps} showMic />);
		const buttons = screen.getAllByRole('button');
		expect(buttons[0].getAttribute('aria-label')).toBe('Scroll to bottom');
		expect(
			screen.queryByRole('button', { name: 'Navigate up' })
		).toBeNull();
	});

	it('shows the back arrow before the scroll arrow on the phone', () => {
		const onBack = vi.fn();
		render(
			<DefaultActionBar {...baseProps} showMic showBack onBack={onBack} />
		);
		const buttons = screen.getAllByRole('button');
		expect(buttons[0].getAttribute('aria-label')).toBe('Navigate up');
		expect(buttons[1].getAttribute('aria-label')).toBe('Scroll to bottom');
		buttons[0].click();
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('calls onScrollToNewest and badges the unread count on the arrow', () => {
		const onScrollToNewest = vi.fn();
		render(
			<DefaultActionBar
				{...baseProps}
				showMic
				onScrollToNewest={onScrollToNewest}
				unreadCount={3}
			/>
		);
		const arrow = screen.getByRole('button', {
			name: 'Scroll to bottom – 3'
		});
		expect(
			arrow.querySelector('.composerToolbar__badge')?.textContent
		).toBe('3');
		arrow.click();
		expect(onScrollToNewest).toHaveBeenCalledTimes(1);
	});

	// T23: "scroll to newest" is a real arrow, not a chevron.
	it('draws the scroll-to-newest control as an arrow-down icon, not a chevron', () => {
		render(<DefaultActionBar {...baseProps} showMic />);
		const arrow = screen.getByRole('button', {
			name: /^Scroll to bottom/
		});
		expect(
			arrow.querySelector('[data-testid="ArrowDownwardIcon"]')
		).toBeTruthy();
		expect(
			arrow.querySelector('[data-testid="KeyboardArrowDownIcon"]')
		).toBeNull();
	});

	it('caps the badge at 99+', () => {
		render(<DefaultActionBar {...baseProps} showMic unreadCount={120} />);
		const arrow = screen.getByRole('button', {
			name: /^Scroll to bottom/
		});
		expect(
			arrow.querySelector('.composerToolbar__badge')?.textContent
		).toBe('99+');
	});
});
