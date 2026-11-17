// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import {
	NotificationsContext,
	RegistrationContext,
	TenantContext
} from '../../../globalState';
import { UrlParamsContext } from '../../../globalState/provider/UrlParamsProvider';
import { AgencySelection } from './AgencySelection';
import { useRegistrationAddon } from '../../../addons/registrationAddon';
import { apiGetAgencyById } from '../../../api';
import { apiGetTopicById } from '../../../api/apiGetTopicId';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../../addons/registrationAddon', () => ({
	useRegistrationAddon: vi.fn()
}));

vi.mock('../../../addons/RegistrationAddonStep', () => ({
	RegistrationAddonStep: (props: {
		topicId?: number;
		postcode?: string;
		onComplete: (result: unknown) => void;
		onBack: () => void;
	}) => (
		<div data-testid="addon-step">
			<span>{`topic ${props.topicId} postcode ${props.postcode}`}</span>
			<button
				type="button"
				onClick={() =>
					props.onComplete({
						agencyId: 12,
						topicId: 9,
						postcode: '10115',
						consultingType: 0,
						registrationRef: 'ref-1'
					})
				}
			>
				complete
			</button>
			<button type="button" onClick={props.onBack}>
				back
			</button>
		</div>
	)
}));

vi.mock('../../../api', () => ({ apiGetAgencyById: vi.fn() }));
vi.mock('../../../api/apiGetTopicId', () => ({ apiGetTopicById: vi.fn() }));

vi.mock(
	'../../../containers/registration/hooks/useAgenciesForRegistration',
	() => ({
		useAgenciesForRegistration: () => ({ isLoading: false, agencies: [] })
	})
);

vi.mock('./AgencySelectionResults', () => ({
	AgencySelectionResults: () => <div data-testid="core-selection" />
}));

const Where = () => (
	<output data-testid="where">{useLocation().pathname}</output>
);

const renderStep = () => {
	const updateRegistrationData = vi.fn();
	const onNextClick = vi.fn();
	const addNotification = vi.fn();
	render(
		<MemoryRouter initialEntries={['/registration/agency-selection']}>
			<TenantContext.Provider value={{ tenant: { id: 7 } } as never}>
				<UrlParamsContext.Provider value={{} as never}>
					<NotificationsContext.Provider
						value={{ addNotification } as never}
					>
						<RegistrationContext.Provider
							value={{
								registrationData: {
									mainTopic: { id: 3 },
									zipcode: '12043'
								} as never,
								updateRegistrationData
							}}
						>
							<AgencySelection
								onChange={vi.fn()}
								nextStepUrl="/registration/account-data"
								prevStepUrl="/registration/zipcode"
								onNextClick={onNextClick}
							/>
							<Where />
						</RegistrationContext.Provider>
					</NotificationsContext.Provider>
				</UrlParamsContext.Provider>
			</TenantContext.Provider>
		</MemoryRouter>
	);
	return { updateRegistrationData, onNextClick, addNotification };
};

describe('AgencySelection with a registration add-on', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('keeps the core selection without an add-on', () => {
		vi.mocked(useRegistrationAddon).mockReturnValue({ status: 'none' });
		renderStep();

		expect(useRegistrationAddon).toHaveBeenCalledWith(7);
		expect(screen.getByTestId('core-selection')).toBeTruthy();
		expect(screen.queryByTestId('addon-step')).toBeNull();
	});

	it('shows the add-on with topic and postcode and takes over its choice', async () => {
		vi.mocked(useRegistrationAddon).mockReturnValue({
			status: 'ready',
			addon: {} as never,
			app: {} as never
		});
		vi.mocked(apiGetAgencyById).mockResolvedValue({
			id: 12,
			name: 'Stelle',
			consultingType: 1
		} as never);
		vi.mocked(apiGetTopicById).mockResolvedValue({ id: 9 } as never);
		const { updateRegistrationData, onNextClick } = renderStep();

		expect(screen.queryByTestId('core-selection')).toBeNull();
		expect(screen.getByText('topic 3 postcode 12043')).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'complete' }));

		await waitFor(() => expect(onNextClick).toHaveBeenCalledTimes(1));
		expect(apiGetAgencyById).toHaveBeenCalledWith(12);
		expect(apiGetTopicById).toHaveBeenCalledWith(9);
		expect(updateRegistrationData).toHaveBeenCalledWith({
			agency: { id: 12, name: 'Stelle', consultingType: 0 },
			mainTopic: { id: 9 },
			zipcode: '10115',
			registrationRef: 'ref-1'
		});
	});

	it('stays on the step with a message when the agency cannot be loaded', async () => {
		vi.mocked(useRegistrationAddon).mockReturnValue({
			status: 'ready',
			addon: {} as never,
			app: {} as never
		});
		vi.mocked(apiGetAgencyById).mockResolvedValue(null as never);
		vi.mocked(apiGetTopicById).mockResolvedValue({ id: 9 } as never);
		const { updateRegistrationData, onNextClick, addNotification } =
			renderStep();

		fireEvent.click(screen.getByRole('button', { name: 'complete' }));

		await waitFor(() => expect(addNotification).toHaveBeenCalled());
		expect(updateRegistrationData).not.toHaveBeenCalled();
		expect(onNextClick).not.toHaveBeenCalled();
	});

	it('goes back to the previous step', () => {
		vi.mocked(useRegistrationAddon).mockReturnValue({
			status: 'ready',
			addon: {} as never,
			app: {} as never
		});
		renderStep();

		fireEvent.click(screen.getByRole('button', { name: 'back' }));

		expect(screen.getByTestId('where').textContent).toBe(
			'/registration/zipcode'
		);
	});

	it('waits for the answer before showing either selection', () => {
		vi.mocked(useRegistrationAddon).mockReturnValue({ status: 'loading' });
		renderStep();

		expect(screen.queryByTestId('core-selection')).toBeNull();
		expect(screen.queryByTestId('addon-step')).toBeNull();
	});
});
