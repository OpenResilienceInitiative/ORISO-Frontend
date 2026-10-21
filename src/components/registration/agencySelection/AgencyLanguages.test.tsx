// @vitest-environment jsdom
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

// Stable `t`: the component re-fetches whenever its identity changes.
const t = (key: string) => key;
const i18n = { language: 'de' };
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t, i18n })
}));

// The globalState barrel pulls in lottie-web, which needs a canvas context
// that jsdom does not implement.
vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));

// The network boundary: the public consultants/languages request.
vi.mock('../../../api/fetchData', async () => {
	const actual = await vi.importActual<
		typeof import('../../../api/fetchData')
	>('../../../api/fetchData');
	return { ...actual, fetchData: vi.fn() };
});

/* eslint-disable import/first -- mocks above */
import { AgencyLanguages } from './AgencyLanguages';
import { fetchData } from '../../../api/fetchData';
import { AppConfigContext } from '../../../globalState/provider/AppConfigProvider';
import { LanguagesContext } from '../../../globalState/provider/LanguagesProvider';
/* eslint-enable import/first */

// Stable reference: the component re-fetches whenever `fixed` changes identity.
const languagesContextValue = { fixed: ['de'], spoken: [] as string[] };

const renderWithTenantSetting = (
	multitenancyWithSingleDomainEnabled: boolean
) =>
	render(
		<AppConfigContext.Provider
			value={{ multitenancyWithSingleDomainEnabled } as any}
		>
			<LanguagesContext.Provider value={languagesContextValue}>
				<AgencyLanguages agencyId={42} />
			</LanguagesContext.Provider>
		</AppConfigContext.Provider>
	);

describe('registration AgencyLanguages', () => {
	beforeEach(() => {
		vi.mocked(fetchData).mockResolvedValue({
			languages: ['en', 'fr', 'ru']
		});
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('requests with the agencyId tenant header and renders all returned languages when single-domain multitenancy is on', async () => {
		renderWithTenantSetting(true);

		expect(
			await screen.findByText(
				'languages.de (DE) | languages.en (EN) | languages.fr (FR) | languages.ru (RU)'
			)
		).toBeTruthy();
		expect(fetchData).toHaveBeenCalledTimes(1);
		expect(vi.mocked(fetchData).mock.calls[0][0]).toMatchObject({
			url: expect.stringContaining('agencyId=42'),
			headersData: { agencyId: 42 }
		});
	});

	it('sends no tenant header when single-domain multitenancy is off', async () => {
		renderWithTenantSetting(false);

		await screen.findByText(/languages\.ru \(RU\)/);
		expect(
			vi.mocked(fetchData).mock.calls[0][0].headersData
		).toBeUndefined();
	});
});
