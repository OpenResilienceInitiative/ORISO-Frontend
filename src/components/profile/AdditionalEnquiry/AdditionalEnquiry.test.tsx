// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdditionalEnquiry } from './AdditionalEnquiry';

const apiGetTenantAgenciesTopicsMock = vi.fn();
const apiPostAdditionalEnquiryMock = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

vi.mock('react-router-dom', () => ({
	useNavigate: () => vi.fn()
}));

vi.mock('../../../globalState', async () => {
	const ReactModule = await import('react');
	return {
		UserDataContext: ReactModule.createContext({
			reloadUserData: vi.fn()
		})
	};
});

vi.mock('../../../api', () => ({
	apiGetTenantAgenciesTopics: (...args: unknown[]) =>
		apiGetTenantAgenciesTopicsMock(...args),
	apiPostAdditionalEnquiry: (...args: unknown[]) =>
		apiPostAdditionalEnquiryMock(...args),
	FETCH_ERRORS: { X_REASON: 'x-reason' },
	X_REASON: {
		USER_ALREADY_REGISTERED_WITH_AGENCY_AND_TOPIC: 'already-registered'
	}
}));

vi.mock('../../form/OrisoSelect', () => ({
	OrisoSelect: ({ label, options, value }: any) => (
		<label>
			{label}
			<select aria-label={label} value={value} readOnly>
				<option value="" />
				{options.map((option: any) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	)
}));

vi.mock('../../button/Button', () => ({
	BUTTON_TYPES: { LINK: 'link', PRIMARY: 'primary' },
	Button: ({ item, disabled }: any) => (
		<button type="button" disabled={disabled}>
			{item.label}
		</button>
	)
}));

vi.mock('../../overlay/Overlay', () => ({
	OVERLAY_FUNCTIONS: {
		REDIRECT: 'redirect',
		LOGOUT: 'logout',
		CLOSE: 'close'
	},
	Overlay: () => null
}));

vi.mock('../../logout/logout', () => ({ logout: vi.fn() }));
vi.mock('../../app/navigationHandler', () => ({ mobileListView: vi.fn() }));
vi.mock('../../headline/Headline', () => ({
	Headline: ({ text }: { text: string }) => <h2>{text}</h2>
}));
vi.mock('../../../resources/img/illustrations/check.svg', () => ({
	ReactComponent: () => <svg />
}));
vi.mock('../../animatedIllustration/AnimatedIllustration', () => ({
	CheckAnimation: () => <svg data-testid="check-animation" />
}));
vi.mock('../../../resources/img/illustrations/x.svg', () => ({
	ReactComponent: () => <svg />
}));
vi.mock('./AdditionalAgencySelection', () => ({
	AdditionalAgencySelection: ({ selectedTopicId }: any) => (
		<div data-testid="agency-selection">topic:{selectedTopicId}</div>
	)
}));

describe('AdditionalEnquiry', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('selects the only available topic and continues to agency selection', async () => {
		apiGetTenantAgenciesTopicsMock.mockResolvedValue([
			{ id: 25, name: 'U25 Suizidprävention' }
		]);

		render(<AdditionalEnquiry />);

		await waitFor(() => {
			expect(screen.getByTestId('agency-selection').textContent).toBe(
				'topic:25'
			);
		});
		expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(
			'25'
		);
	});
});
