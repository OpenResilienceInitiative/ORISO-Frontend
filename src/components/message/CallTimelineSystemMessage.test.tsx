// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CallTimelineSystemMessage } from './CallTimelineSystemMessage';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback || key
	})
}));

describe('CallTimelineSystemMessage', () => {
	afterEach(cleanup);

	it('renders a running video call as an actionable shared system card', () => {
		const onJoin = vi.fn();
		const view = render(
			<CallTimelineSystemMessage
				state="running"
				callType="video"
				callLabel="Video call"
				headline="Video call in progress"
				statusLabel="In progress"
				description="The call is active."
				actionLabel="Join"
				onAction={onJoin}
			/>
		);

		expect(
			view.container.querySelector('[data-cy="chat-system-message"]')
		).toBeTruthy();
		expect(screen.getByTestId('VideocamRoundedIcon')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Join' }));
		expect(onJoin).toHaveBeenCalledTimes(1);
	});

	it('shows stable named avatars and the participant count', () => {
		render(
			<CallTimelineSystemMessage
				state="running"
				callType="audio"
				callLabel="Audio call"
				headline="Audio call in progress"
				statusLabel="In progress"
				description="The call is active."
				participantsLabel="In the call"
				participants={[
					{
						userId: '@yak:example',
						username: 'Gentle Yak',
						displayName: 'Gentle Yak'
					},
					{
						userId: '@wolf:example',
						username: 'Calm Wolf',
						displayName: 'Calm Wolf'
					}
				]}
			/>
		);

		const caption = screen.getByText('In the call · 2');
		expect(caption).toBeTruthy();
		expect(getComputedStyle(caption).fontSize).toBe('12px');
		expect(getComputedStyle(caption).lineHeight).toBe('16px');
		expect(getComputedStyle(caption).fontWeight).toBe('500');
		expect(getComputedStyle(caption).letterSpacing).toBe('0.5px');
		expect(screen.getByRole('img', { name: 'Gentle Yak' })).toBeTruthy();
		expect(screen.getByRole('img', { name: 'Calm Wolf' })).toBeTruthy();
	});

	it('keeps the selected M3 action letter spacing', () => {
		render(
			<CallTimelineSystemMessage
				state="running"
				callType="video"
				callLabel="Video call"
				headline="Video call in progress"
				statusLabel="In progress"
				description="The call is active."
				actionLabel="Join"
				onAction={vi.fn()}
			/>
		);

		expect(
			getComputedStyle(screen.getByRole('button', { name: 'Join' }))
				.letterSpacing
		).toBe('0.1px');
	});

	it('uses the off icon and no action for missed calls even when a duration is known', () => {
		render(
			<CallTimelineSystemMessage
				state="missed"
				callType="video"
				callLabel="Video call"
				headline="Missed video call"
				statusLabel="Missed"
				description="The call was not answered."
				durationLabel="Duration: 02:05"
				actionLabel="Join"
				onAction={vi.fn()}
			/>
		);

		expect(screen.getByTestId('VideocamOffRoundedIcon')).toBeTruthy();
		expect(screen.getByText('Duration: 02:05')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('keeps an absent action non-actionable and exposes a join failure in the card', () => {
		const view = render(
			<CallTimelineSystemMessage
				state="running"
				callType="audio"
				callLabel="Audio call"
				headline="Audio call in progress"
				statusLabel="In progress"
				description="The call is active."
				actionLabel="Join"
			/>
		);
		expect(screen.queryByRole('button')).toBeNull();

		view.rerender(
			<CallTimelineSystemMessage
				state="running"
				callType="audio"
				callLabel="Audio call"
				headline="Audio call in progress"
				statusLabel="In progress"
				description="The call is active."
				actionLabel="Join"
				actionDisabled
				actionStatusLabel="Unable to join"
				onAction={vi.fn()}
			/>
		);
		expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(
			true
		);
		expect(
			screen.getByText('Unable to join').getAttribute('aria-live')
		).toBe('polite');
	});
});
