// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TopicSelection } from './TopicSelection';
import { apiGetTopicGroups } from '../../../api/apiGetTopicGroups';
import { apiGetTopicsData } from '../../../api/apiGetTopicsData';
import { LocaleContext } from '../../../globalState/context/LocaleContext';
import { RegistrationContext } from '../../../globalState/provider/RegistrationProvider';
import type { RegistrationData } from '../../../globalState/provider/RegistrationProvider';
import { UrlParamsContext } from '../../../globalState/provider/UrlParamsProvider';
import { TopicsDataInterface } from '../../../globalState/interfaces/TopicsDataInterface';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key
	})
}));

vi.mock('../../../components/app/Loading', () => ({
	Loading: () => <div>loading topics</div>
}));

vi.mock('../../../globalState/provider/RegistrationProvider', async () => {
	const ReactModule = await import('react');

	return {
		RegistrationContext: ReactModule.createContext({})
	};
});

vi.mock('../../../globalState/provider/UrlParamsProvider', async () => {
	const ReactModule = await import('react');

	return {
		UrlParamsContext: ReactModule.createContext({
			agency: null,
			consultingType: null,
			consultant: null,
			topic: null,
			loaded: true,
			slugFallback: undefined,
			zipcode: undefined
		})
	};
});

vi.mock('../../../api/apiGetTopicGroups', () => ({
	apiGetTopicGroups: vi.fn()
}));

vi.mock('../../../api/apiGetTopicsData', () => ({
	apiGetTopicsData: vi.fn()
}));

const apiGetTopicGroupsMock = vi.mocked(apiGetTopicGroups);
const apiGetTopicsDataMock = vi.mocked(apiGetTopicsData);

const topic = (id: number, name: string): TopicsDataInterface =>
	({
		id,
		name,
		slug: name.toLowerCase().replace(/\s+/g, '-'),
		description: '',
		internalIdentifier: `topic-${id}`,
		status: 'ACTIVE',
		createDate: '2026-06-25T00:00:00Z',
		updateDate: '2026-06-25T00:00:00Z',
		fallbackUrl: '',
		titles: {
			short: name,
			long: name,
			registrationDropdown: name,
			welcome: name
		}
	}) as TopicsDataInterface;

const OFFERED = topic(9, 'Schuldenberatung');
const NOT_OFFERED = topic(99, 'Suchtberatung');

const renderWithCarriedOverTopic = (
	mainTopic: TopicsDataInterface,
	setDisabledNextButton: ReturnType<typeof vi.fn>
) =>
	render(
		<LocaleContext.Provider
			value={{
				locale: 'de',
				initLocale: 'de',
				setLocale: vi.fn(),
				locales: ['de'],
				selectableLocales: ['de']
			}}
		>
			<UrlParamsContext.Provider
				value={{
					// The centre the advice seeker is looking at now. It offers
					// 9 only — 99 belongs to the centre they came from.
					agency: { id: 5, topicIds: [9] },
					consultingType: null,
					consultant: null,
					topic: null,
					loaded: true,
					slugFallback: undefined,
					zipcode: undefined
				}}
			>
				<RegistrationContext.Provider
					value={{
						registrationData: {
							mainTopic,
							mainTopicId: mainTopic.id
						} as RegistrationData,
						setDisabledNextButton
					}}
				>
					<TopicSelection
						onChange={vi.fn()}
						nextStepUrl="/next"
						onNextClick={vi.fn()}
					/>
				</RegistrationContext.Provider>
			</UrlParamsContext.Provider>
		</LocaleContext.Provider>
	);

describe('TopicSelection — a subject area carried over from another centre', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	const withTopics = () => {
		apiGetTopicsDataMock.mockResolvedValue([OFFERED, NOT_OFFERED]);
		apiGetTopicGroupsMock.mockResolvedValue({
			data: { items: [{ id: 1, name: 'Allgemein', topicIds: [9] }] }
		});
	};

	it('does not confirm a subject area this centre does not offer', async () => {
		withTopics();
		const setDisabledNextButton = vi.fn();

		renderWithCarriedOverTopic(NOT_OFFERED, setDisabledNextButton);

		expect(await screen.findByText('Schuldenberatung')).toBeDefined();
		// It is not even on screen — confirming it would let the advice seeker
		// continue with a pick that belongs to a different centre (#1524).
		expect(screen.queryByText('Suchtberatung')).toBeNull();
		expect(setDisabledNextButton).not.toHaveBeenCalledWith(false);
	});

	it('still confirms a subject area this centre does offer', async () => {
		withTopics();
		const setDisabledNextButton = vi.fn();

		renderWithCarriedOverTopic(OFFERED, setDisabledNextButton);

		expect(await screen.findByText('Schuldenberatung')).toBeDefined();
		await waitFor(() =>
			expect(setDisabledNextButton).toHaveBeenCalledWith(false)
		);
	});
});
