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
	RegistrationProvider
} from './RegistrationProvider';
import { UrlParamsContext } from './UrlParamsProvider';
import { getUrlParameter } from '../../utils/getUrlParameter';

vi.mock('../../utils/getUrlParameter', () => ({
	getUrlParameter: vi.fn()
}));
vi.mock('../../api/apiGetTopicId', () => ({
	apiGetTopicById: vi.fn()
}));
vi.mock('../../api', () => ({
	apiGetAgencyById: vi.fn(),
	apiGetConsultingType: vi.fn().mockResolvedValue({ id: 1 })
}));
// Only the provider's own state is under test; the step components are not.
vi.mock('../../components/registration/topicSelection/TopicSelection', () => ({
	TopicSelection: () => null
}));
vi.mock('../../components/registration/zipcodeInput/ZipcodeInput', () => ({
	ZipcodeInput: () => null
}));
vi.mock(
	'../../components/registration/agencySelection/AgencySelection',
	() => ({ AgencySelection: () => null })
);
vi.mock('../../components/registration/accountData/AccountData', () => ({
	AccountData: () => null
}));

const getUrlParameterMock = vi.mocked(getUrlParameter);

/** The postcode UserService reads as "anonymous Live Chat guest". */
const GUEST_POSTCODE = '00000';
const TOPIC = { id: 14, name: 'Schulden' };

const Probe = () => {
	const { registrationData, availableSteps } =
		useContext(RegistrationContext);
	return (
		<div>
			<span data-testid="agency">
				{registrationData?.agency?.id ?? 'none'}
			</span>
			<span data-testid="zipcode">
				{registrationData?.zipcode ?? 'none'}
			</span>
			<span data-testid="steps">
				{(availableSteps ?? []).map((step) => step.name).join(',')}
			</span>
		</div>
	);
};

const renderWith = (urlParams: { agency?: unknown; consultant?: unknown }) =>
	render(
		<UrlParamsContext.Provider
			value={
				{
					loaded: true,
					agency: urlParams.agency ?? null,
					consultingType: null,
					consultant: urlParams.consultant ?? null,
					topic: TOPIC,
					slugFallback: undefined,
					zipcode: undefined
				} as never
			}
		>
			<MemoryRouter>
				<RegistrationProvider>
					<Probe />
				</RegistrationProvider>
			</MemoryRouter>
		</UrlParamsContext.Provider>
	);

const agency = (id: number, postcode?: string) => ({
	id,
	name: `Beratungsstelle ${id}`,
	consultingType: 1,
	topicIds: [TOPIC.id],
	...(postcode === undefined ? {} : { postcode })
});

/*
 * A direct agency or counsellor link skips the postcode step. The registration
 * still has to carry a postcode, and it used to be the placeholder "00000" —
 * which UserService classifies as an anonymous Live Chat guest: the privacy
 * confirmation is cleared and the enquiry stays hidden from every counsellor
 * until an in-chat consent that a form registration never shows (Dev, case 263,
 * 23 Nov 2026). The link's own agency postcode is what the person registers with.
 */
describe('RegistrationProvider — the postcode a direct link registers with', () => {
	beforeEach(() => {
		sessionStorage.clear();
		getUrlParameterMock.mockImplementation((name: string) =>
			name === 'aid' ? '2' : name === 'tid' ? '14' : null
		);
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it("registers an agency link with that agency's postcode, never the guest placeholder", async () => {
		renderWith({ agency: agency(2, '10965') });

		await waitFor(() =>
			expect(screen.getByTestId('agency').textContent).toBe('2')
		);
		expect(screen.getByTestId('zipcode').textContent).toBe('10965');
		expect(screen.getByTestId('zipcode').textContent).not.toBe(
			GUEST_POSTCODE
		);
		expect(screen.getByTestId('steps').textContent).not.toContain(
			'zipcode'
		);
	});

	it('asks for the postcode when the linked agency has none, instead of sending the placeholder', async () => {
		renderWith({ agency: agency(2) });

		await waitFor(() =>
			expect(screen.getByTestId('agency').textContent).toBe('2')
		);
		expect(screen.getByTestId('zipcode').textContent).toBe('none');
		expect(screen.getByTestId('steps').textContent).toContain('zipcode');
	});

	it("registers a counsellor link with the counsellor's agency postcode", async () => {
		getUrlParameterMock.mockImplementation((name: string) =>
			name === 'cid' ? 'c-1' : null
		);
		renderWith({
			consultant: {
				consultantId: 'c-1',
				agencies: [agency(4, '13353')]
			}
		});

		await waitFor(() =>
			expect(screen.getByTestId('agency').textContent).toBe('4')
		);
		expect(screen.getByTestId('zipcode').textContent).toBe('13353');
	});
});
