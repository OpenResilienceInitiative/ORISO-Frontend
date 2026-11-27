// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { apiGetConsultantStatistics } from '../../api/apiGetConsultantStatistics';
import { useTenant } from '../../globalState/provider/TenantProvider';
import { CounsellorDashboardWired } from './CounsellorDashboardWired';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));
vi.mock('../../globalState/provider/TenantProvider', () => ({
	useTenant: vi.fn(() => null)
}));
vi.mock('../../api/apiGetConsultantStatistics', () => ({
	apiGetConsultantStatistics: vi.fn()
}));

const renderWired = () =>
	render(
		<CounsellorDashboardWired
			headline="headline"
			variant="conversation-nothing-to-do"
		/>
	);

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('CounsellorDashboardWired', () => {
	it('keeps the empty pane and shows no figures until they arrive', async () => {
		vi.mocked(apiGetConsultantStatistics).mockReturnValue(
			new Promise(() => undefined)
		);
		renderWired();
		await screen.findByTestId('counsellor-dashboard');
		expect(screen.getByText('headline')).toBeTruthy();
		expect(screen.queryByTestId('counsellor-dashboard-figures')).toBeNull();
	});

	it('shows active and newly taken on, nothing else', async () => {
		vi.mocked(apiGetConsultantStatistics).mockResolvedValue({
			numberOfAssignedSessions: 11,
			numberOfActiveSessions: 5,
			numberOfSentMessages: 131
		} as never);
		renderWired();
		const figures = await screen.findByTestId(
			'counsellor-dashboard-figures'
		);
		expect(figures.textContent).toBe(
			'5dashboard.quiet.active11dashboard.quiet.assigned'
		);
		expect(screen.queryByText('131')).toBeNull();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('asks for no figures where the Träger switched statistics off', async () => {
		vi.mocked(useTenant).mockReturnValue({
			settings: { featureStatisticsEnabled: false }
		} as never);
		renderWired();
		await screen.findByTestId('counsellor-dashboard');
		expect(apiGetConsultantStatistics).not.toHaveBeenCalled();
	});
});
