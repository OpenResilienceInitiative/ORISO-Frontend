// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CallTimelineSystemMessage } from './CallTimelineSystemMessage';

describe('CallTimelineSystemMessage', () => {
	afterEach(cleanup);

	it('renders a running call as an actionable system message', () => {
		const onJoin = vi.fn();

		render(
			<CallTimelineSystemMessage
				state="running"
				callType="video"
				callLabel="Videoanruf"
				headline="Beraterin Carimat hat einen Videoanruf gestartet"
				statusLabel="Läuft"
				description="Sie können jetzt an der Videokonferenz teilnehmen."
				actionLabel="Beitreten"
				onAction={onJoin}
			/>
		);

		expect(screen.getByRole('status').getAttribute('aria-label')).toBe(
			'Videoanruf: Läuft'
		);
		expect(screen.getByTestId('VideocamRoundedIcon')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Beitreten' }));
		expect(onJoin).toHaveBeenCalledTimes(1);
	});

	it('renders an ended call as a quiet log entry without an action', () => {
		render(
			<CallTimelineSystemMessage
				state="ended"
				callType="video"
				callLabel="Videoanruf"
				headline="Du hast den Videoanruf beendet"
				statusLabel="Beendet"
				durationLabel="Dauer 29 Min."
				description="Der Videoanruf ist beendet."
			/>
		);

		expect(screen.getByTestId('VideocamOffRoundedIcon')).toBeTruthy();
		expect(screen.getByText('Dauer 29 Min.')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('distinguishes an audio call and exposes its current members', () => {
		render(
			<CallTimelineSystemMessage
				state="running"
				callType="audio"
				callLabel="Audioanruf"
				headline="Ein Audioanruf läuft"
				statusLabel="Läuft"
				description="Sie können jetzt teilnehmen."
				participantsLabel="Im Anruf"
				participants={[
					{
						userId: '@yak:oriso.org',
						username: 'yak',
						displayName: 'Sanftes Yak'
					},
					{
						userId: '@wolf:oriso.org',
						username: 'wolf',
						displayName: 'Ruhiger Wolf'
					}
				]}
			/>
		);

		expect(screen.getByTestId('CallRoundedIcon')).toBeTruthy();
		expect(screen.getByRole('group', { name: 'Im Anruf' })).toBeTruthy();
		expect(screen.getByText('Im Anruf · 2')).toBeTruthy();
	});

	it('accepts the existing calendar control for a scheduled call', () => {
		render(
			<CallTimelineSystemMessage
				state="scheduled"
				callType="video"
				callLabel="Videoanruf"
				headline="Ein Videoanruf ist geplant"
				statusLabel="Geplant"
				scheduledForLabel="Do., 10. September · 18:00 Uhr"
				description="Der Termin dauert 60 Minuten."
				actionSlot={
					<button type="button">In Kalender eintragen</button>
				}
			/>
		);

		expect(screen.getByTestId('EventRoundedIcon')).toBeTruthy();
		expect(screen.getByText('Do., 10. September · 18:00 Uhr')).toBeTruthy();
		expect(
			screen.getByRole('button', { name: 'In Kalender eintragen' })
		).toBeTruthy();
	});
});
