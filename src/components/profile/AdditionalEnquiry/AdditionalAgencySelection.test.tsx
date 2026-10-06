// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdditionalAgencySelection } from './AdditionalAgencySelection';

const apiGetAgenciesByTenant = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock('../../../api', () => ({
	apiGetAgenciesByTenant: (postcode: string, topicId: number) =>
		apiGetAgenciesByTenant(postcode, topicId),
	FETCH_ERRORS: { EMPTY: 'EMPTY' }
}));

vi.mock('../../inputField/InputField', () => ({
	InputField: ({ item, inputHandle }: any) => (
		<input
			aria-label={item.name}
			value={item.content}
			onChange={inputHandle}
		/>
	)
}));

vi.mock('../../text/Text', () => ({
	Text: ({ text }: { text: string }) => <p>{text}</p>
}));

vi.mock('../../headline/Headline', () => ({
	Headline: ({ text }: { text: string }) => <h2>{text}</h2>
}));

vi.mock('../../agencyRadioSelect/AgencyRadioSelect', () => ({
	AgencyRadioSelect: ({ agency }: any) => (
		<div data-testid={`agency-${agency.id}`}>{agency.name}</div>
	)
}));

const SUICIDE_PREVENTION_TOPIC = 3;
const SOCIAL_COUNSELLING_TOPIC = 1;

const agencyForSuicidePrevention = {
	id: 1,
	name: 'Test',
	postcode: '21212',
	consultingType: 1,
	topicIds: [SUICIDE_PREVENTION_TOPIC]
};

describe('AdditionalAgencySelection', () => {
	beforeEach(() => {
		apiGetAgenciesByTenant.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	/**
	 * ORISO-Frontend#1143: the agency list is queried per topic. When the asker
	 * switches to a topic this agency does not serve, the previously selected
	 * agency must not survive into the submitted enquiry.
	 */
	it('drops the selected agency when the topic no longer offers it', async () => {
		const onAgencyChange = vi.fn();
		apiGetAgenciesByTenant.mockResolvedValue([agencyForSuicidePrevention]);

		const { rerender } = render(
			<AdditionalAgencySelection
				selectedTopicId={SUICIDE_PREVENTION_TOPIC}
				initialPostcode="21212"
				onAgencyChange={onAgencyChange}
				onPostcodeChange={vi.fn()}
			/>
		);

		await waitFor(() =>
			expect(onAgencyChange).toHaveBeenCalledWith(
				expect.objectContaining({ id: agencyForSuicidePrevention.id })
			)
		);

		// no agency serves the newly picked topic at this postcode
		apiGetAgenciesByTenant.mockResolvedValue([]);
		onAgencyChange.mockClear();

		rerender(
			<AdditionalAgencySelection
				selectedTopicId={SOCIAL_COUNSELLING_TOPIC}
				initialPostcode="21212"
				onAgencyChange={onAgencyChange}
				onPostcodeChange={vi.fn()}
			/>
		);

		await waitFor(() =>
			expect(apiGetAgenciesByTenant).toHaveBeenCalledWith(
				'21212',
				SOCIAL_COUNSELLING_TOPIC
			)
		);

		await waitFor(() => expect(onAgencyChange).toHaveBeenCalledWith(null));
		expect(onAgencyChange).not.toHaveBeenCalledWith(
			expect.objectContaining({ id: agencyForSuicidePrevention.id })
		);
	});

	it('selects the first agency the newly picked topic offers', async () => {
		const onAgencyChange = vi.fn();
		apiGetAgenciesByTenant.mockResolvedValue([agencyForSuicidePrevention]);

		const { rerender } = render(
			<AdditionalAgencySelection
				selectedTopicId={SUICIDE_PREVENTION_TOPIC}
				initialPostcode="21212"
				onAgencyChange={onAgencyChange}
				onPostcodeChange={vi.fn()}
			/>
		);

		await waitFor(() =>
			expect(onAgencyChange).toHaveBeenCalledWith(
				expect.objectContaining({ id: 1 })
			)
		);

		const agencyForSocialCounselling = {
			id: 8,
			name: 'AVV Demo Beratungsstelle',
			postcode: '55116',
			consultingType: 1,
			topicIds: [SOCIAL_COUNSELLING_TOPIC]
		};
		apiGetAgenciesByTenant.mockResolvedValue([agencyForSocialCounselling]);
		onAgencyChange.mockClear();

		rerender(
			<AdditionalAgencySelection
				selectedTopicId={SOCIAL_COUNSELLING_TOPIC}
				initialPostcode="21212"
				onAgencyChange={onAgencyChange}
				onPostcodeChange={vi.fn()}
			/>
		);

		await waitFor(() =>
			expect(onAgencyChange).toHaveBeenCalledWith(
				expect.objectContaining({ id: agencyForSocialCounselling.id })
			)
		);
	});
});
