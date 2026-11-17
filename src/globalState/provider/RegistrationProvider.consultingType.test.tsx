// @vitest-environment oriso-jsdom
import * as React from 'react';
import { useContext } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	RegistrationContext,
	RegistrationProvider,
	registrationSessionStorageKey
} from './RegistrationProvider';
import { UrlParamsContext } from './UrlParamsProvider';
import { apiGetAgencyById, apiGetConsultingType } from '../../api';
import { getUrlParameter } from '../../utils/getUrlParameter';

vi.mock('../../utils/getUrlParameter', () => ({
	getUrlParameter: vi.fn()
}));
vi.mock('../../api/apiGetTopicId', () => ({
	apiGetTopicById: vi.fn()
}));
vi.mock('../../api', () => ({
	apiGetAgencyById: vi.fn(),
	apiGetConsultingType: vi.fn()
}));
vi.mock('../../components/registration/topicSelection/TopicSelection', () => ({
	TopicSelection: () => null
}));
vi.mock('../../components/registration/zipcodeInput/ZipcodeInput', () => ({
	ZipcodeInput: () => null
}));
vi.mock(
	'../../components/registration/agencySelection/AgencySelection',
	() => ({
		AgencySelection: () => null
	})
);
vi.mock('../../components/registration/accountData/AccountData', () => ({
	AccountData: () => null
}));

const AGENCY_ID = 5;

const Probe = () => {
	const { registrationData } = useContext(RegistrationContext);
	return (
		<span data-testid="consulting-type">
			{registrationData?.agency?.consultingType ?? 'none'}
		</span>
	);
};

const renderProvider = () =>
	render(
		<UrlParamsContext.Provider
			value={{
				loaded: true,
				agency: null,
				consultingType: null,
				consultant: null,
				topic: null,
				slugFallback: undefined,
				zipcode: undefined
			}}
		>
			<MemoryRouter>
				<RegistrationProvider>
					<Probe />
				</RegistrationProvider>
			</MemoryRouter>
		</UrlParamsContext.Provider>
	);

const stored = () =>
	JSON.parse(sessionStorage.getItem(registrationSessionStorageKey) || '{}');

describe('RegistrationProvider: the consulting type a registration add-on chose', () => {
	beforeEach(() => {
		vi.mocked(getUrlParameter).mockReturnValue(null);
		vi.mocked(apiGetConsultingType).mockResolvedValue({ id: 0 } as never);
		vi.mocked(apiGetAgencyById).mockResolvedValue({
			id: AGENCY_ID,
			name: 'Beratungsstelle',
			consultingType: 1
		} as never);
		sessionStorage.clear();
	});
	afterEach(cleanup);

	it('survives a reload instead of falling back to the agency default', async () => {
		sessionStorage.setItem(
			registrationSessionStorageKey,
			JSON.stringify({ agencyId: AGENCY_ID, agencyConsultingType: 0 })
		);

		renderProvider();

		await waitFor(() =>
			expect(screen.getByTestId('consulting-type').textContent).toBe('0')
		);
		expect(stored()).toMatchObject({
			agencyId: AGENCY_ID,
			agencyConsultingType: 0
		});
	});

	it('keeps the agency default without a stored choice', async () => {
		sessionStorage.setItem(
			registrationSessionStorageKey,
			JSON.stringify({ agencyId: AGENCY_ID })
		);

		renderProvider();

		await waitFor(() =>
			expect(screen.getByTestId('consulting-type').textContent).toBe('1')
		);
		expect(stored().agencyConsultingType).toBe(1);
	});
});
