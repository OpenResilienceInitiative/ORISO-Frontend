// @vitest-environment jsdom
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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	RegistrationContext,
	RegistrationProvider
} from './RegistrationProvider';
import { UrlParamsContext } from './UrlParamsProvider';
import { apiGetTopicById } from '../../api/apiGetTopicId';
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
	() => ({ AgencySelection: () => null })
);
vi.mock('../../components/registration/accountData/AccountData', () => ({
	AccountData: () => null
}));

const topicMock = vi.mocked(apiGetTopicById);
const consultingTypeMock = vi.mocked(apiGetConsultingType);

const agency = {
	id: 19,
	name: 'Beratungsstelle',
	topicIds: [17],
	consultingType: 1
};
const grief = { id: 17, name: 'Trauerberatung' };

const Probe = () => {
	const {
		registrationData,
		registrationConsultingType,
		hasRegistrationDataError,
		retryRegistrationData
	} = useContext(RegistrationContext);
	return (
		<div>
			<span data-testid="main-topic">
				{registrationData?.mainTopic?.id ?? 'none'}
			</span>
			<span data-testid="consulting-type">
				{registrationConsultingType ? 'loaded' : 'none'}
			</span>
			<span data-testid="error">
				{String(!!hasRegistrationDataError)}
			</span>
			<button onClick={() => retryRegistrationData?.()}>retry</button>
		</div>
	);
};

const renderInvite = () =>
	render(
		<UrlParamsContext.Provider
			value={{
				loaded: true,
				agency: agency as never,
				consultingType: null,
				consultant: null,
				topic: null,
				slugFallback: undefined,
				zipcode: undefined
			}}
		>
			<MemoryRouter
				initialEntries={['/registration/account-data?gcid=19&aid=19']}
			>
				<RegistrationProvider>
					<Probe />
				</RegistrationProvider>
			</MemoryRouter>
		</UrlParamsContext.Provider>
	);

const error = () => screen.getByTestId('error').textContent;

/**
 * A self-help invite link waits for the group's topic and consulting type
 * before it shows its entry screen (#1499). A failed load must surface as an
 * error the page can retry; before, it left the entry pending — a blank page.
 */
describe('RegistrationProvider — invite link data that fails to load', () => {
	beforeEach(() => {
		vi.mocked(getUrlParameter).mockImplementation((name: string) =>
			name === 'aid' ? '19' : null
		);
		sessionStorage.clear();
		consultingTypeMock.mockResolvedValue({ id: 1 } as never);
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('reports a failed topic load and recovers on retry', async () => {
		topicMock.mockRejectedValueOnce(new Error('503'));
		topicMock.mockResolvedValue(grief as never);

		renderInvite();

		await waitFor(() => expect(error()).toBe('true'));
		expect(screen.getByTestId('main-topic').textContent).toBe('none');

		fireEvent.click(screen.getByText('retry'));

		await waitFor(() =>
			expect(screen.getByTestId('main-topic').textContent).toBe('17')
		);
		expect(error()).toBe('false');
	});

	it('reports an empty topic answer as a failure', async () => {
		topicMock.mockResolvedValue(undefined as never);

		renderInvite();

		await waitFor(() => expect(error()).toBe('true'));
	});

	it('reports a failed consulting type load and recovers on retry', async () => {
		topicMock.mockResolvedValue(grief as never);
		consultingTypeMock.mockRejectedValueOnce(new Error('503'));

		renderInvite();

		await waitFor(() => expect(error()).toBe('true'));
		expect(screen.getByTestId('consulting-type').textContent).toBe('none');

		fireEvent.click(screen.getByText('retry'));

		await waitFor(() =>
			expect(screen.getByTestId('consulting-type').textContent).toBe(
				'loaded'
			)
		);
		expect(error()).toBe('false');
	});

	it('reports an empty consulting type answer as a failure', async () => {
		topicMock.mockResolvedValue(grief as never);
		consultingTypeMock.mockResolvedValue(undefined as never);

		renderInvite();

		await waitFor(() => expect(error()).toBe('true'));
	});

	it('stays error-free when both loads succeed', async () => {
		topicMock.mockResolvedValue(grief as never);

		renderInvite();

		await waitFor(() =>
			expect(screen.getByTestId('consulting-type').textContent).toBe(
				'loaded'
			)
		);
		expect(screen.getByTestId('main-topic').textContent).toBe('17');
		expect(error()).toBe('false');
	});
});
