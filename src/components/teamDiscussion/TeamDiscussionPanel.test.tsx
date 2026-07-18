// @vitest-environment jsdom
/**
 * FE#514 / ADR-016 — presentational contract of the Team-Besprechung panel:
 * permanent team-only marker, hard-close read-only state, composer gating.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TeamDiscussionPanelView } from './TeamDiscussionPanelView';
import type { TeamDiscussionMessage } from './teamDiscussionHelpers';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			options && 'count' in options ? `${key}:${options.count}` : key
	})
}));

const message = (id: string, isOwn = false): TeamDiscussionMessage => ({
	id,
	senderMatrixId: '@kim:oriso',
	senderDisplayName: 'Kim',
	body: `Body ${id}`,
	ts: 1700000000000,
	isOwn
});

const baseProps = {
	messages: [] as TeamDiscussionMessage[],
	isOpen: true,
	draft: '',
	isSending: false,
	error: null,
	onToggle: vi.fn(),
	onDraftChange: vi.fn(),
	onSend: vi.fn()
};

describe('TeamDiscussionPanelView', () => {
	afterEach(cleanup);

	it('always shows the permanent team-only marker when open', () => {
		render(
			<TeamDiscussionPanelView
				{...baseProps}
				discussion={{
					matrixRoomId: '!room:oriso',
					status: 'OPEN',
					archiveDate: null
				}}
			/>
		);
		expect(screen.getByText('teamDiscussion.teamOnlyMarker')).toBeTruthy();
	});

	it('renders composer for OPEN discussions and calls onSend', () => {
		const onSend = vi.fn();
		render(
			<TeamDiscussionPanelView
				{...baseProps}
				draft="Hallo Team"
				onSend={onSend}
				discussion={{
					matrixRoomId: '!room:oriso',
					status: 'OPEN',
					archiveDate: null
				}}
			/>
		);
		const send = screen.getByText('teamDiscussion.send');
		expect(send.hasAttribute('disabled')).toBe(false);
		fireEvent.click(send);
		expect(onSend).toHaveBeenCalledTimes(1);
	});

	it('disables send while sending or with empty draft', () => {
		render(
			<TeamDiscussionPanelView
				{...baseProps}
				draft=""
				discussion={{
					matrixRoomId: '!room:oriso',
					status: 'OPEN',
					archiveDate: null
				}}
			/>
		);
		expect(
			screen.getByText('teamDiscussion.send').hasAttribute('disabled')
		).toBe(true);
	});

	it('hard close: ARCHIVED shows banner + chip and no composer', () => {
		render(
			<TeamDiscussionPanelView
				{...baseProps}
				messages={[message('1'), message('2')]}
				discussion={{
					matrixRoomId: '!room:oriso',
					status: 'ARCHIVED',
					archiveDate: '2026-07-18T10:00:00'
				}}
			/>
		);
		expect(screen.getByText('teamDiscussion.archivedChip')).toBeTruthy();
		expect(
			screen.queryByPlaceholderText('teamDiscussion.placeholder')
		).toBeNull();
		expect(screen.queryByText('teamDiscussion.send')).toBeNull();
	});

	it('shows the post count and renders messages chronologically', () => {
		render(
			<TeamDiscussionPanelView
				{...baseProps}
				messages={[message('1'), message('2'), message('3')]}
				discussion={{
					matrixRoomId: '!room:oriso',
					status: 'OPEN',
					archiveDate: null
				}}
			/>
		);
		expect(screen.getByText('teamDiscussion.postCount:3')).toBeTruthy();
		expect(screen.getByText('Body 2')).toBeTruthy();
	});

	it('offers the start hint when no discussion exists yet', () => {
		render(<TeamDiscussionPanelView {...baseProps} discussion={null} />);
		expect(screen.getByText('teamDiscussion.startHint')).toBeTruthy();
	});

	it('surfaces errors as an alert', () => {
		render(
			<TeamDiscussionPanelView
				{...baseProps}
				error="teamDiscussion.error.send"
				discussion={{
					matrixRoomId: '!room:oriso',
					status: 'OPEN',
					archiveDate: null
				}}
			/>
		);
		expect(screen.getByRole('alert').textContent).toBe(
			'teamDiscussion.error.send'
		);
	});
});
