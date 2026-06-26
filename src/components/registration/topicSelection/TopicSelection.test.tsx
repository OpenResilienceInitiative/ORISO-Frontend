// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
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

const topicWithSlug = (
	id: number,
	name: string,
	slug: string
): TopicsDataInterface => ({
	...topic(id, name),
	slug,
	internalIdentifier: slug
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

	it('renders the curated presentation categories with duplicate topic placements', async () => {
		apiGetTopicsDataMock.mockResolvedValue([
			topicWithSlug(
				1,
				'Allgemeine Sozialberatung',
				'general-social-counselling'
			),
			topicWithSlug(
				2,
				'Kinder und Jugendliche',
				'children-youth-counselling'
			),
			topicWithSlug(3, 'U25 Suizidprävention', 'u25-suicide-prevention'),
			topicWithSlug(
				4,
				'Rechtliche Betreuung und Vorsorge',
				'legal-guardianship-advance-care'
			),
			topicWithSlug(7, 'HIV und Aids', 'hiv-aids'),
			topicWithSlug(
				8,
				'Kinder- und Jugend-Reha',
				'child-youth-rehabilitation'
			),
			topicWithSlug(
				9,
				'Aus-, Rück- und Weiterwanderung',
				'initial-return-further-migration'
			),
			topicWithSlug(10, 'Eltern und Familie', 'parents-and-family'),
			topicWithSlug(
				11,
				'Behinderung und psychische Beeinträchtigung',
				'disability-psychological-impairment'
			),
			topicWithSlug(15, 'Leben im Alter', 'life-in-old-age'),
			topicWithSlug(
				16,
				'Kuren für Mütter und Väter',
				'cures-mothers-fathers'
			)
		]);

		renderTopicSelection();

		expect(
			await screen.findByText('Familie, Kinder & Jugend')
		).toBeDefined();
		expect(screen.getByText('Alter, Pflege & Abschied')).toBeDefined();
		expect(
			screen.getByText('Soziale Notlagen, Krisen & Finanzen')
		).toBeDefined();
		expect(
			screen.getByText('Gesundheit, Behinderung & Sucht')
		).toBeDefined();
		expect(screen.getByText('Migration & Integration')).toBeDefined();

		fireEvent.click(
			screen.getByText('Soziale Notlagen, Krisen & Finanzen')
		);

		expect(screen.getAllByText('U25 Suizidprävention')).toHaveLength(2);
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
