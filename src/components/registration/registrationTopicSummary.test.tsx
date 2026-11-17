// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { Registration } from './Registration';
import {
	AppConfigContext,
	LocaleContext,
	NotificationsContext,
	RegistrationContext,
	TenantContext
} from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';

const { getTopics } = vi.hoisted(() => ({ getTopics: vi.fn() }));

/** Lottie touches a canvas 2d context at module load; jsdom has none. */
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../components/stageLayout/StageLayout', () => ({
	StageLayout: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	)
}));
vi.mock('../../api/apiGetTopicsData', () => ({
	apiGetTopicsData: () => getTopics()
}));

/**
 * The summary under the steps names and pictures the topic picked on the first
 * step. A catalogue topic (from the topic service) arrives in one language and
 * may sit in a category with its own picture; both must survive later steps.
 */
const Step = () => <div data-testid="step-body" />;
const availableSteps = [
	{
		name: 'topic-selection',
		component: Step,
		mandatoryFields: ['mainTopic']
	},
	{ name: 'zipcode', component: Step, mandatoryFields: ['zipcode'] }
];

const debtPickedHere = {
	id: 14,
	slug: 'debt',
	name: 'Schulden',
	description: 'Hilfe bei Schulden',
	icon: '/service/topic/public/icons/t-05-schulden.png'
};
/** The topic step before "Weiter": the pick lives in the step, not yet in the context. */
const PickingStep = ({ onChange }: { onChange: (data: unknown) => void }) => {
	React.useEffect(() => {
		onChange({ mainTopicId: 14, mainTopic: debtPickedHere });
	}, [onChange]);
	return <div data-testid="step-body" />;
};
const pickingSteps = [
	{
		name: 'topic-selection',
		component: PickingStep,
		mandatoryFields: ['mainTopic']
	},
	{ name: 'zipcode', component: Step, mandatoryFields: ['zipcode'] }
];

const debtDe = {
	id: 14,
	slug: 'debt',
	name: 'Schulden',
	description: 'Hilfe bei Schulden',
	icon: '/service/topic/public/icons/t-05-schulden.png'
};
const debtEn = { ...debtDe, name: 'Debt', description: 'Help with debt' };

const screenFor = (
	locale: string,
	data: Record<string, unknown>,
	updateRegistrationData = vi.fn(),
	{ steps = availableSteps, at = 'zipcode' } = {}
) => (
	<AppConfigContext.Provider value={{} as any}>
		<GlobalComponentContext.Provider
			value={{ Stage: () => <div /> } as any}
		>
			<NotificationsContext.Provider
				value={{ addNotification: () => undefined } as any}
			>
				<TenantContext.Provider value={{ tenant: null } as any}>
					<LocaleContext.Provider value={{ locale } as any}>
						<RegistrationContext.Provider
							value={
								{
									disabledNextButton: false,
									setDisabledNextButton: () => undefined,
									updateRegistrationData,
									registrationData: data,
									availableSteps: steps,
									registrationConsultingType: null
								} as any
							}
						>
							<MemoryRouter
								initialEntries={[`/registration/${at}`]}
							>
								<Routes>
									<Route
										path="/registration/:step"
										element={<Registration />}
									/>
								</Routes>
							</MemoryRouter>
						</RegistrationContext.Provider>
					</LocaleContext.Provider>
				</TenantContext.Provider>
			</NotificationsContext.Provider>
		</GlobalComponentContext.Provider>
	</AppConfigContext.Provider>
);

afterEach(() => {
	cleanup();
	getTopics.mockReset();
	sessionStorage.clear();
});

describe('registration — the picked topic in the summary', () => {
	it('fetches a catalogue topic again when the language changes on a later step', async () => {
		getTopics.mockResolvedValue([debtEn]);
		const update = vi.fn();
		const data = { mainTopicId: 14, mainTopic: debtDe, topicGroupId: 3 };
		const view = render(screenFor('de', data, update));
		expect(getTopics).not.toHaveBeenCalled();

		view.rerender(screenFor('en', data, update));

		await waitFor(() =>
			expect(update).toHaveBeenCalledWith({ mainTopic: debtEn })
		);
	});

	it('follows a language switch for a topic picked but not yet confirmed', async () => {
		getTopics.mockResolvedValue([debtEn]);
		const update = vi.fn();
		const onTopicStep = { steps: pickingSteps, at: 'topic-selection' };
		const view = render(screenFor('de', {}, update, onTopicStep));
		await waitFor(() =>
			expect(document.body.textContent).toContain('Schulden')
		);

		view.rerender(screenFor('en', {}, update, onTopicStep));

		await waitFor(() =>
			expect(document.body.textContent).toContain('Debt')
		);
		expect(document.body.textContent).not.toContain('Schulden');
	});

	it('keeps the picture of the category the topic was picked in', () => {
		const crisisPicture = '/bundled/crisis-u25.png';
		render(
			screenFor('de', {
				mainTopicId: 14,
				mainTopic: debtDe,
				topicGroupId: 42,
				topicIcon: crisisPicture
			})
		);

		expect(
			document.querySelector(`img[src="${crisisPicture}"]`)
		).not.toBeNull();
	});
});
