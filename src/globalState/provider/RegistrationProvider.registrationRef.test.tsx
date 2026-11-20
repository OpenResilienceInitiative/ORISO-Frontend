// @vitest-environment oriso-jsdom
import * as React from 'react';
import { useContext } from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
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
	RegistrationData,
	RegistrationProvider,
	registrationSessionStorageKey
} from './RegistrationProvider';
import { UrlParamsContext } from './UrlParamsProvider';
import { apiGetConsultingType } from '../../api';
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

const agency = (id: number) => ({ id, name: `Stelle ${id}` }) as never;

const updates: Record<string, Partial<RegistrationData>> = {
	'add-on chooses': { agency: agency(12), registrationRef: 'ref-1' },
	'unrelated': { age: '30' },
	'same postcode': { zipcode: '10115' },
	'postcode changes': {
		zipcode: '20095',
		agency: undefined,
		agencyId: undefined
	},
	'core chooses another': { agency: agency(13) },
	'add-on chooses again': { agency: agency(13), registrationRef: 'ref-2' }
};

const Probe = () => {
	const { registrationData, updateRegistrationData } =
		useContext(RegistrationContext);
	return (
		<>
			<span data-testid="ref">
				{registrationData?.registrationRef ?? 'none'}
			</span>
			{Object.entries(updates).map(([name, data]) => (
				<button
					key={name}
					type="button"
					onClick={() => updateRegistrationData?.(data)}
				>
					{name}
				</button>
			))}
		</>
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

const click = (name: string) =>
	fireEvent.click(screen.getByRole('button', { name }));
const ref = () => screen.getByTestId('ref').textContent;
const stored = () =>
	JSON.parse(sessionStorage.getItem(registrationSessionStorageKey) || '{}');

describe('RegistrationProvider: the ref of a registration add-on', () => {
	beforeEach(async () => {
		vi.mocked(getUrlParameter).mockReturnValue(null);
		vi.mocked(apiGetConsultingType).mockResolvedValue({ id: 0 } as never);
		sessionStorage.clear();
		renderProvider();
		await screen.findByRole('button', { name: 'add-on chooses' });
		click('add-on chooses');
		await waitFor(() => expect(ref()).toBe('ref-1'));
	});
	afterEach(cleanup);

	it('stays while its agency stays', async () => {
		click('unrelated');
		click('same postcode');

		await waitFor(() => expect(stored().zipcode).toBe('10115'));
		expect(ref()).toBe('ref-1');
		expect(stored().registrationRef).toBe('ref-1');
	});

	it('goes when a changed postcode clears its agency', async () => {
		click('postcode changes');

		await waitFor(() => expect(ref()).toBe('none'));
		click('core chooses another');
		await waitFor(() => expect(stored().agencyId).toBe(13));
		expect(ref()).toBe('none');
		expect(stored().registrationRef).toBeUndefined();
	});

	it('goes when the core selection replaces its agency', async () => {
		click('core chooses another');

		await waitFor(() => expect(ref()).toBe('none'));
	});

	it('is replaced by the ref of a new add-on choice', async () => {
		click('add-on chooses again');

		await waitFor(() => expect(ref()).toBe('ref-2'));
	});
});
