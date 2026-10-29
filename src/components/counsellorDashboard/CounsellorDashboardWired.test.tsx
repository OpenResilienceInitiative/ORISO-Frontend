// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { apiGetConsultantStatistics } from '../../api/apiGetConsultantStatistics';
import { useDirectLinks } from '../conversationCreate/directLink/useDirectLinks';
import { CounsellorDashboardWired } from './CounsellorDashboardWired';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));
vi.mock('../../globalState/provider/TenantProvider', () => ({
	useTenant: () => null
}));
vi.mock('../../api/apiGetConsultantSessionList', () => ({
	apiGetConsultantSessionList: vi.fn(() => Promise.resolve({ sessions: [] }))
}));
vi.mock('../../api/apiGetConsultantStatistics', () => ({
	apiGetConsultantStatistics: vi.fn()
}));
vi.mock('../conversationCreate/directLink/useDirectLinks', () => ({
	useDirectLinks: vi.fn()
}));

const link = {
	id: '1',
	name: 'Sucht',
	medium: 'CHAT',
	active: true,
	url: 'https://example.test/l/1'
};
const linksState = (overrides = {}) => ({
	links: [link],
	loaded: true,
	loadFailed: false,
	reload: vi.fn(),
	create: vi.fn(),
	toggle: vi.fn(),
	...overrides
});

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('CounsellorDashboardWired', () => {
	it('shows no statistics tile until the figures arrive', async () => {
		vi.mocked(useDirectLinks).mockReturnValue(linksState() as never);
		vi.mocked(apiGetConsultantStatistics).mockReturnValue(
			new Promise(() => undefined)
		);
		render(<CounsellorDashboardWired fallback={<p>fallback</p>} />);
		await screen.findByTestId('counsellor-dashboard');
		expect(
			document.querySelector('.counsellorDashboard__stats')
		).toBeNull();
	});

	it('says the links failed to load instead of "all caught up"', async () => {
		const state = linksState({ links: [], loadFailed: true });
		vi.mocked(useDirectLinks).mockReturnValue(state as never);
		vi.mocked(apiGetConsultantStatistics).mockRejectedValue(new Error());
		render(<CounsellorDashboardWired fallback={<p>fallback</p>} />);
		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('directLink.page.loadFailed');
		expect(screen.queryByText('fallback')).toBeNull();
		fireEvent.click(
			screen.getByRole('button', { name: 'groupChat.loadError.retry' })
		);
		expect(state.reload).toHaveBeenCalledOnce();
	});
});
