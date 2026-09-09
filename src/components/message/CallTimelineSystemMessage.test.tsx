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
});
