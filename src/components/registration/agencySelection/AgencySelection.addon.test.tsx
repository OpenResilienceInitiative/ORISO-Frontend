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
	useRegistrationAddon: vi.fn(),
	useRegistrationTenantId: (tenantId: number | undefined) => tenantId ?? null
}));

vi.mock('../../../addons/RegistrationAddonStep', () => ({
	RegistrationAddonStep: (props: {
		topicId?: number;
		postcode?: string;
		onComplete: (result: unknown) => void;
		onBack: () => void;
		onUnavailable?: () => void;
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
			<button type="button" onClick={props.onUnavailable}>
				fail
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

const renderStep = ({
	linkTopic,
	registrationRef
}: { linkTopic?: { id: number }; registrationRef?: string } = {}) => {
	const updateRegistrationData = vi.fn();
	const setDisabledNextButton = vi.fn();
	const onNextClick = vi.fn();
	const addNotification = vi.fn();
	const view = render(
		<MemoryRouter initialEntries={['/registration/agency-selection']}>
			<TenantContext.Provider value={{ tenant: { id: 7 } } as never}>
				<UrlParamsContext.Provider
					value={{ topic: linkTopic } as never}
				>
					<NotificationsContext.Provider
						value={{ addNotification } as never}
					>
						<RegistrationContext.Provider
							value={{
								registrationData: {
									mainTopic: { id: 3 },
									zipcode: '12043',
									registrationRef
								} as never,
								updateRegistrationData,
								setDisabledNextButton
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
	return {
		view,
		updateRegistrationData,
		setDisabledNextButton,
		onNextClick,
		addNotification
	};
};

const withAddon = () =>
	vi.mocked(useRegistrationAddon).mockReturnValue({
		status: 'ready',
		addon: {} as never,
		app: {} as never
	});

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

	it('disables the host Next button while the add-on looks up or owns the step', () => {
		vi.mocked(useRegistrationAddon).mockReturnValue({ status: 'loading' });
		expect(renderStep().setDisabledNextButton).toHaveBeenCalledWith(true);
		cleanup();

		withAddon();
		expect(renderStep().setDisabledNextButton).toHaveBeenCalledWith(true);
		cleanup();

		vi.mocked(useRegistrationAddon).mockReturnValue({ status: 'none' });
		expect(renderStep().setDisabledNextButton).not.toHaveBeenCalled();
	});

	it('falls back to the core selection when the add-on cannot be shown', () => {
		withAddon();
		renderStep();

		fireEvent.click(screen.getByRole('button', { name: 'fail' }));

		expect(screen.queryByTestId('addon-step')).toBeNull();
		expect(screen.getByTestId('core-selection')).toBeTruthy();
	});

	it('drops an earlier add-on ref once the core selection takes the step', () => {
		withAddon();
		const { updateRegistrationData } = renderStep({
			registrationRef: 'ref-1'
		});
		expect(updateRegistrationData).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole('button', { name: 'fail' }));

		expect(updateRegistrationData).toHaveBeenCalledWith({
			registrationRef: undefined
		});
	});

	it('drops a completion that resolves after the step was left', async () => {
		withAddon();
		let answer: (agency: unknown) => void = () => {};
		vi.mocked(apiGetAgencyById).mockReturnValue(
			new Promise((resolve) => {
				answer = resolve;
			}) as never
		);
		vi.mocked(apiGetTopicById).mockResolvedValue({ id: 9 } as never);
		const { view, updateRegistrationData, onNextClick } = renderStep();

		fireEvent.click(screen.getByRole('button', { name: 'complete' }));
		view.unmount();
		answer({ id: 12, consultingType: 1 });
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(updateRegistrationData).not.toHaveBeenCalled();
		expect(onNextClick).not.toHaveBeenCalled();
	});

	it('rejects a topic other than the one the registration link names', async () => {
		withAddon();
		const { updateRegistrationData, onNextClick, addNotification } =
			renderStep({ linkTopic: { id: 3 } });

		fireEvent.click(screen.getByRole('button', { name: 'complete' }));

		await waitFor(() => expect(addNotification).toHaveBeenCalled());
		expect(apiGetAgencyById).not.toHaveBeenCalled();
		expect(updateRegistrationData).not.toHaveBeenCalled();
		expect(onNextClick).not.toHaveBeenCalled();
	});
});
