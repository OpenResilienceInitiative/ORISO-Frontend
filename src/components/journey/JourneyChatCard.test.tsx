// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { JourneyChatCard } from './JourneyChatCard';
import { arrivalStep, flightStep } from './journeyFixtures';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

describe('a journey step asked in the chat (#2333)', () => {
	it('does not send while a required question is open, and says which', async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(
			<JourneyChatCard
				step={flightStep}
				phase="flight"
				language="de"
				onSubmit={onSubmit}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'journey.chat.send' })
		);
		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getAllByRole('alert')[0].textContent).toBe(
			'journey.question.missing'
		);
	});

	it('sends the answers once the required ones are given', async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(
			<JourneyChatCard
				step={flightStep}
				phase="flight"
				language="de"
				onSubmit={onSubmit}
			/>
		);
		fireEvent.click(
			screen.getByRole('radio', { name: 'Mahnungen oder Inkasso' })
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'journey.chat.send' })
		);
		await waitFor(() =>
			expect(onSubmit).toHaveBeenCalledWith({
				questions: {
					situation: { choices: ['letters'], text: undefined }
				},
				ratings: {}
			})
		);
	});

	it('keeps the answers and says so when sending fails', async () => {
		const onSubmit = vi.fn().mockRejectedValue(new Error('offline'));
		render(
			<JourneyChatCard
				step={flightStep}
				phase="flight"
				language="de"
				onSubmit={onSubmit}
			/>
		);
		fireEvent.click(
			screen.getByRole('radio', { name: 'Mahnungen oder Inkasso' })
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'journey.chat.send' })
		);
		expect(await screen.findByText('journey.chat.failed')).toBeTruthy();
		expect(
			(
				screen.getByRole('radio', {
					name: 'Mahnungen oder Inkasso'
				}) as HTMLInputElement
			).checked
		).toBe(true);
	});

	it('"something else" opens its own text field', () => {
		render(
			<JourneyChatCard
				step={flightStep}
				phase="flight"
				language="de"
				onSubmit={vi.fn()}
			/>
		);
		fireEvent.click(
			screen.getByRole('radio', { name: 'journey.question.other' })
		);
		expect(document.activeElement).toBe(
			screen.getByRole('textbox', {
				name: 'journey.question.otherPlaceholder'
			})
		);
	});

	it('once sent, shows a short summary and asks nothing again', () => {
		render(
			<JourneyChatCard
				step={arrivalStep}
				phase="arrival"
				language="de"
				sent={{ questions: {}, ratings: { satisfaction: 4 } }}
				onSubmit={vi.fn()}
			/>
		);
		expect(screen.getByText('journey.chat.thanks')).toBeTruthy();
		expect(screen.getByText('★★★★☆')).toBeTruthy();
		expect(
			screen.queryByRole('button', { name: 'journey.chat.send' })
		).toBeNull();
	});
});
