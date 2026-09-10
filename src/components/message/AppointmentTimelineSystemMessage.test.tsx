// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppointmentTimelineSystemMessage } from './AppointmentTimelineSystemMessage';

describe('AppointmentTimelineSystemMessage', () => {
	afterEach(cleanup);

	it.each(['requested', 'scheduled', 'accepted', 'declined'] as const)(
		'renders the semantic %s icon',
		(state) => {
			render(
				<AppointmentTimelineSystemMessage
					state={state}
					initiatorName="Beraterin Lea"
					actionSummaryLabel="Videoanruf in den Kalender eintragen"
					description="Terminstatus"
				/>
			);
			expect(
				screen.getByTestId(`appointment-${state}-icon`)
			).toBeTruthy();
		}
	);

	it('uses the outgoing orientation and keeps its action on the sender side', () => {
		const onAction = vi.fn();
		const { container } = render(
			<AppointmentTimelineSystemMessage
				state="requested"
				side="sent"
				initiatorName="Sanftes Alpaka Kim"
				actionSummaryLabel="Terminanfrage gesendet"
				description="Beraterin Lea kann den Termin annehmen."
				actionLabel="Anfrage ansehen"
				onAction={onAction}
			/>
		);
		expect(container.querySelector('.messageItem--right')).toBeTruthy();
		fireEvent.click(
			screen.getByRole('button', { name: 'Anfrage ansehen' })
		);
		expect(onAction).toHaveBeenCalledTimes(1);
	});
});
