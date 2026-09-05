// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
	translate: ((_key: string, fallback?: string) => fallback ?? _key) as any
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
		const arrow = screen.getByRole('button', { name: 'Scroll to bottom' });
		expect(
			arrow.querySelector('[data-testid="ArrowDownwardIcon"]')
		).toBeTruthy();
		expect(
			arrow.querySelector('[data-testid="KeyboardArrowDownIcon"]')
		).toBeNull();
	});

	it('caps the badge at 99+', () => {
		render(<DefaultActionBar {...baseProps} showMic unreadCount={120} />);
		expect(
			document.querySelector('.composerToolbar__badge')?.textContent
		).toBe('99+');
	});
});
