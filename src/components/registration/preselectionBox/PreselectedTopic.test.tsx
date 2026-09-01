// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TopicsDataInterface } from '../../../globalState/interfaces';

vi.mock('../registrationDesign/registrationDesign', () => ({
	getRegistrationTopicDisplay: vi.fn(() => ({
		title: 'Parents et famille',
		description: ''
	}))
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'fr' }
	})
}));

/* eslint-disable import/first -- mocks above */
import PreselectedTopic from './PreselectedTopic';
import { getRegistrationTopicDisplay } from '../registrationDesign/registrationDesign';
/* eslint-enable import/first */

const germanApiTopic = {
	id: 1,
	name: 'Eltern und Familie',
	slug: 'parents-and-family',
	titles: {
		long: 'Eltern und Familie',
		short: 'Eltern',
		registrationDropdown: 'Eltern und Familie',
		welcome: 'Willkommen'
	}
} as TopicsDataInterface;

describe('PreselectedTopic locale (#1154)', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('renders the locale-aware catalogue title instead of the German API title', () => {
		render(
			<PreselectedTopic hasError={false} topic={germanApiTopic} sx={{}} />
		);

		expect(getRegistrationTopicDisplay).toHaveBeenCalledWith(
			germanApiTopic,
			'fr'
		);
		expect(screen.getByText('Parents et famille')).toBeTruthy();
		expect(screen.queryByText('Eltern und Familie')).toBeNull();
	});
});
