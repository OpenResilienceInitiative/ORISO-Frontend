// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DefaultActionBar } from './DefaultActionBar';

afterEach(() => cleanup());

const baseProps = {
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
});
