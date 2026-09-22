// @vitest-environment jsdom
import * as React from 'react';
import { useContext } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	RegistrationContext,
	RegistrationProvider,
	registrationSessionStorageKey
} from './RegistrationProvider';
import { UrlParamsContext } from './UrlParamsProvider';
import { apiGetTopicById } from '../../api/apiGetTopicId';
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

// The step registry pulls in the real step components, whose import chains reach
// i18n, lottie and other browser-only module-scope work. Nothing here renders a
// step; only the provider's own state handling is under test.
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

const getUrlParameterMock = vi.mocked(getUrlParameter);
const apiGetTopicByIdMock = vi.mocked(apiGetTopicById);
const apiGetAgencyByIdMock = vi.mocked(apiGetAgencyById);
const apiGetConsultingTypeMock = vi.mocked(apiGetConsultingType);

const CARRIED_OVER_TOPIC_ID = 99;
const AGENCY_ID = 5;

const Probe = () => {
	const { registrationData } = useContext(RegistrationContext);

	return (
		<div>
			<span data-testid="main-topic">
				{registrationData?.mainTopic?.id ?? 'none'}
			</span>
			<span data-testid="main-topic-id">
				{registrationData?.mainTopicId ?? 'none'}
			</span>
			<span data-testid="agency">
				{registrationData?.agency?.id ?? 'none'}
			</span>
		</div>
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
			<RegistrationProvider>
				<Probe />
			</RegistrationProvider>
		</UrlParamsContext.Provider>
	);

/** The state a second centre's registration link is opened with. */
const givenStoredRegistration = (agencyTopicIds: number[]) => {
	sessionStorage.setItem(
		registrationSessionStorageKey,
		JSON.stringify({
			username: '',
			password: '',
			zipcode: '00000',
			agencyId: AGENCY_ID,
			mainTopicId: CARRIED_OVER_TOPIC_ID
		})
	);
	apiGetTopicByIdMock.mockResolvedValue({
		id: CARRIED_OVER_TOPIC_ID,
		name: 'Suchtberatung'
	} as never);
	apiGetAgencyByIdMock.mockResolvedValue({
		id: AGENCY_ID,
		name: 'Beratungsstelle B',
		consultingType: 1,
		topicIds: agencyTopicIds
	} as never);
	apiGetConsultingTypeMock.mockResolvedValue({ id: 1 } as never);
};

describe('RegistrationProvider — restoring a subject area at another centre', () => {
	beforeEach(() => {
		getUrlParameterMock.mockReturnValue(null);
		sessionStorage.clear();
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('drops a stored subject area the stored centre does not offer', async () => {
		givenStoredRegistration([9]);

		renderProvider();

		await waitFor(() =>
			expect(screen.getByTestId('agency').textContent).toBe(
				String(AGENCY_ID)
			)
		);
		/* Left in place, this pair reaches the consent lookup, answers 404, and
		   is read as "this centre has no own wording" — so the advice seeker
		   consents to the platform fallback without being told (#1524). */
		expect(screen.getByTestId('main-topic').textContent).toBe('none');
		expect(screen.getByTestId('main-topic-id').textContent).toBe('none');
	});

	it('keeps a stored subject area the stored centre does offer', async () => {
		givenStoredRegistration([9, CARRIED_OVER_TOPIC_ID]);

		renderProvider();

		await waitFor(() =>
			expect(screen.getByTestId('main-topic').textContent).toBe(
				String(CARRIED_OVER_TOPIC_ID)
			)
		);
		expect(screen.getByTestId('agency').textContent).toBe(
			String(AGENCY_ID)
		);
	});

	it('keeps a stored subject area when the centre has no readable topic list', async () => {
		givenStoredRegistration(undefined as never);

		renderProvider();

		// Not knowing is not proof of a mismatch, and must not cost the advice
		// seeker a selection they legitimately made.
		await waitFor(() =>
			expect(screen.getByTestId('main-topic').textContent).toBe(
				String(CARRIED_OVER_TOPIC_ID)
			)
		);
	});
});
