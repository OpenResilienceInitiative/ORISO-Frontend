// @vitest-environment jsdom

import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConsultantStatistics } from './ConsultantStatistics';

const apiGetConsultantStatisticsMock = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

vi.mock('../../api', () => ({
	apiGetConsultantStatistics: (...args: unknown[]) =>
		apiGetConsultantStatisticsMock(...args)
}));

// Icon imports are SVGR (`ReactComponent as X from '*.svg'`), which this
// project's vitest setup does not transform - no existing test renders an
// icon component directly, so this gap was latent until now. Mocking the
// icon modules (rather than adding a project-wide SVGR transform) keeps the
// fix scoped to this test file.
vi.mock('../../resources/img/icons/persons.svg', () => ({
	ReactComponent: () => <svg data-testid="icon-persons" />
}));
vi.mock('../../resources/img/icons/speech-bubble.svg', () => ({
	ReactComponent: () => <svg data-testid="icon-speech-bubble" />
}));
vi.mock('../../resources/img/icons/speech-bubble-plus.svg', () => ({
	ReactComponent: () => <svg data-testid="icon-speech-bubble-plus" />
}));
vi.mock('../../resources/img/icons/download.svg', () => ({
	ReactComponent: () => <svg data-testid="icon-download" />
}));

describe('ConsultantStatistics', () => {
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
		expect(screen.getByTestId('icon-speech-bubble-plus')).toBeDefined();
		// Assigned/active tiles still render alongside the new one.
		expect(screen.getByText('7')).toBeDefined();
		expect(screen.getByText('3')).toBeDefined();
	});

	it('defaults the messages-sent tile to 0 before the first response arrives', () => {
		apiGetConsultantStatisticsMock.mockReturnValue(new Promise(() => {}));

		render(<ConsultantStatistics />);

		expect(screen.getAllByText('0')).toHaveLength(3);
	});
});
