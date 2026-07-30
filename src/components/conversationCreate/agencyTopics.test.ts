import { describe, expect, it } from 'vitest';
import { AgencyDataInterface } from '../../globalState/interfaces/UserDataInterface';
import { filterTopicsForAgencies, getAgencyTopicIds } from './agencyTopics';

const agency = (
	id: number,
	extra: Partial<AgencyDataInterface> = {}
): AgencyDataInterface =>
	({
		id,
		name: `Agency ${id}`,
		city: '',
		consultingType: 1,
		description: '',
		offline: false,
		postcode: '',
		...extra
	}) as AgencyDataInterface;

const TENANT_TOPICS = [
	{ id: 1, name: 'Schulden' },
	{ id: 2, name: 'Sozialberatung' },
	{ id: 3, name: 'U25 Suizidprävention' }
];

describe('agencyTopics', () => {
	it('offers only the topics of the selected agency', () => {
		const agencies = [
			agency(5, { topicIds: [1, 3] }),
			agency(6, { topicIds: [2] })
		];
		expect(filterTopicsForAgencies(TENANT_TOPICS, agencies, 5)).toEqual([
			{ id: 1, name: 'Schulden' },
			{ id: 3, name: 'U25 Suizidprävention' }
		]);
	});

	it('unions the counsellor topics while no agency is selected', () => {
		const agencies = [
			agency(5, { topicIds: [1] }),
			agency(6, { topicIds: [2] })
		];
		expect(
			filterTopicsForAgencies(TENANT_TOPICS, agencies, null).map(
				(topic) => topic.id
			)
		).toEqual([1, 2]);
	});

	it('falls back to the departments when topicIds are absent', () => {
		const agencies = [
			agency(5, { departments: [{ topicId: 2 }, { topicId: 3 }] })
		];
		expect(getAgencyTopicIds(agencies, 5)).toEqual([2, 3]);
	});

	it('keeps the tenant list when the backend sends no agency topics', () => {
		const agencies = [agency(5)];
		expect(getAgencyTopicIds(agencies, 5)).toBeNull();
		expect(filterTopicsForAgencies(TENANT_TOPICS, agencies, 5)).toEqual(
			TENANT_TOPICS
		);
	});

	it('keeps the tenant list when nothing matches, so the picker is never empty', () => {
		const agencies = [agency(5, { topicIds: [99] })];
		expect(filterTopicsForAgencies(TENANT_TOPICS, agencies, 5)).toEqual(
			TENANT_TOPICS
		);
	});

	it('deduplicates topics shared by several agencies', () => {
		const agencies = [
			agency(5, { topicIds: [1, 2] }),
			agency(6, { topicIds: [2] })
		];
		expect(getAgencyTopicIds(agencies, null)).toEqual([1, 2]);
	});
});
