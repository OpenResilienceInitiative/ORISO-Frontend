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

const topic = (id: number, name: string): TopicsDataInterface => ({
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
});

const renderTopicSelection = () =>
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
					agency: null,
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
						registrationData: {} as RegistrationData,
						setDisabledNextButton: vi.fn()
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

describe('TopicSelection', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('renders public topics without requiring legacy agency coverage', async () => {
		apiGetTopicsDataMock.mockResolvedValue([
			topic(9, 'Schuldenberatung'),
			topic(10, 'Mietberatung')
		]);
		apiGetTopicGroupsMock.mockResolvedValue({
			data: {
				items: [
					{
						id: 1,
						name: 'Allgemein',
						topicIds: [9, 10]
					}
				]
			}
		});

		renderTopicSelection();

		expect(await screen.findByText('Schuldenberatung')).toBeDefined();
		expect(screen.getByText('Mietberatung')).toBeDefined();
	});

	it('leaves loading state when the public topics request fails', async () => {
		apiGetTopicsDataMock.mockRejectedValue(new Error('network'));

		renderTopicSelection();

		await waitFor(() => {
			expect(screen.queryByText('loading topics')).toBeNull();
		});
		expect(apiGetTopicGroupsMock).not.toHaveBeenCalled();
	});
});
