// @vitest-environment oriso-jsdom

import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { ConsultantStatistics } from './ConsultantStatistics';

const apiGetConsultantStatisticsMock = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

vi.mock('../../api', () => ({
	FETCH_ERRORS: { CATCH_ALL: 'CATCH_ALL' },
	apiGetConsultantStatistics: (...args: unknown[]) =>
		apiGetConsultantStatisticsMock(...args)
}));

describe('ConsultantStatistics', () => {
	afterEach(cleanup);

	it('renders the messages-sent tile from the API response', async () => {
		apiGetConsultantStatisticsMock.mockResolvedValue({
			startDate: '2026-07-01',
			endDate: '2026-07-31',
			numberOfAssignedSessions: 7,
			numberOfActiveSessions: 3,
			numberOfSentMessages: 12
		});

		render(<ConsultantStatistics />);

		await waitFor(() => {
			expect(screen.getByText('12')).toBeDefined();
		});
		expect(
			screen.getByText(
				'profile.statistics.csvHeader.numberOfSentMessages'
			)
		).toBeDefined();
		// Assigned/active tiles still render alongside the new one.
		expect(screen.getByText('7')).toBeDefined();
		expect(screen.getByText('3')).toBeDefined();
	});

	it('catches errors itself so a failed request never opens the error page', () => {
		apiGetConsultantStatisticsMock.mockReturnValue(new Promise(() => {}));

		render(<ConsultantStatistics />);

		expect(apiGetConsultantStatisticsMock).toHaveBeenLastCalledWith(
			expect.objectContaining({ responseHandling: ['CATCH_ALL'] })
		);
	});

	it('asks for the current month split into weeks by default', () => {
		apiGetConsultantStatisticsMock.mockReturnValue(new Promise(() => {}));

		render(<ConsultantStatistics />);

		expect(apiGetConsultantStatisticsMock).toHaveBeenLastCalledWith(
			expect.objectContaining({ breakdown: 'WEEK' })
		);
		const { startDate } = apiGetConsultantStatisticsMock.mock.lastCall[0];
		expect(startDate).toMatch(/-01$/);
	});

	it('shows realised appointments with their kinds and the cancelled ones', async () => {
		const loadStatistics = vi.fn().mockResolvedValue({
			startDate: '2026-07-01',
			endDate: '2026-07-31',
			numberOfAssignedSessions: 1,
			numberOfActiveSessions: 2,
			numberOfSentMessages: 30,
			numberOfAppointments: 9,
			numberOfVideoAppointments: 4,
			numberOfPhoneAppointments: 3,
			numberOfOnsiteAppointments: 1,
			numberOfChatAppointments: 1,
			numberOfCancelledAppointments: 5
		});

		const { container } = render(
			<ConsultantStatistics loadStatistics={loadStatistics} />
		);

		await waitFor(() => {
			expect(screen.getByText('9')).toBeDefined();
		});
		const tile = container.querySelector(
			'[data-figure="numberOfAppointments"]'
		);
		expect(tile?.textContent).toContain(
			'profile.statistics.kind.numberOfVideoAppointments4'
		);
		expect(tile?.textContent).toContain(
			'profile.statistics.kind.numberOfCancelledAppointments5'
		);
	});

	it('shows a dash for every figure and no download while loading', () => {
		apiGetConsultantStatisticsMock.mockReturnValue(new Promise(() => {}));

		const { container } = render(<ConsultantStatistics />);

		const figures = [
			...container.querySelectorAll('.statistics__tileValue')
		].map((node) => node.textContent);
		expect(figures).toEqual(['–', '–', '–', '–']);
		expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
		expect(
			screen.queryByText('profile.statistics.complete.download.csv')
		).toBeNull();
	});

	it('shows a retry notice when the figures cannot be loaded', async () => {
		const loadStatistics = vi
			.fn()
			.mockRejectedValueOnce(new Error('503'))
			.mockResolvedValue({
				startDate: '2026-07-01',
				endDate: '2026-07-31',
				numberOfAssignedSessions: 2,
				numberOfActiveSessions: 0,
				numberOfSentMessages: 0
			});

		render(<ConsultantStatistics loadStatistics={loadStatistics} />);

		const retry = await screen.findByRole('button', {
			name: 'profile.statistics.state.retry'
		});
		retry.click();
		await waitFor(() => {
			expect(screen.getByText('2')).toBeDefined();
		});
		expect(loadStatistics).toHaveBeenCalledTimes(2);
	});

	it('says so when the period has no figures at all', async () => {
		const loadStatistics = vi.fn().mockResolvedValue({
			startDate: '2026-07-01',
			endDate: '2026-07-31',
			numberOfAssignedSessions: 0,
			numberOfActiveSessions: 0,
			numberOfSentMessages: 0
		});

		render(<ConsultantStatistics loadStatistics={loadStatistics} />);

		expect(
			await screen.findByText('profile.statistics.state.empty')
		).toBeDefined();
	});

	it('asks for the year split into months when Jahr is chosen', async () => {
		apiGetConsultantStatisticsMock.mockReturnValue(new Promise(() => {}));

		render(<ConsultantStatistics />);
		screen
			.getByRole('button', { name: 'profile.statistics.period.unitYear' })
			.click();

		await waitFor(() =>
			expect(apiGetConsultantStatisticsMock).toHaveBeenLastCalledWith(
				expect.objectContaining({ breakdown: 'MONTH' })
			)
		);
		const { startDate } = apiGetConsultantStatisticsMock.mock.lastCall[0];
		expect(startDate).toMatch(/-01-01$/);
	});
});
