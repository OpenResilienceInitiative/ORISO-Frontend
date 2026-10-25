// @vitest-environment oriso-jsdom

import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { NewRequestDialog } from './NewRequestDialog';

const apiGetTenantAgenciesTopicsMock = vi.fn();
const apiGetTopicsDataMock = vi.fn();
const apiPostAdditionalEnquiryMock = vi.fn();

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' }
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

vi.mock('../../../api/apiGetTopicsData', () => ({
	apiGetTopicsData: (...args: unknown[]) => apiGetTopicsDataMock(...args)
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
	Button: ({ item, disabled, buttonHandle }: any) => (
		<button type="button" disabled={disabled} onClick={buttonHandle}>
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
	Overlay: ({ item }: any) => <div data-testid="overlay">{item.headline}</div>
}));

vi.mock('../../logout/logout', () => ({ logout: vi.fn() }));
vi.mock('../../app/navigationHandler', () => ({ mobileListView: vi.fn() }));
vi.mock('../../animatedIllustration/AnimatedIllustration', () => ({
	CheckAnimation: () => <svg data-testid="check-animation" />
}));
vi.mock('../../../resources/img/illustrations/x.svg', () => ({
	ReactComponent: () => <svg />
}));
vi.mock('../AdditionalEnquiry/AdditionalAgencySelection', () => ({
	AdditionalAgencySelection: ({
		selectedTopicId,
		initialPostcode,
		knownAgencyIds,
		onAgencyChange,
		onPostcodeChange
	}: any) => {
		// Picks a centre the way the real step does once it has an answer.
		React.useEffect(() => {
			if (initialPostcode) {
				onAgencyChange({ id: 42, consultingType: 1 });
				onPostcodeChange(initialPostcode);
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, []);
		return (
			<div data-testid="agency-selection">
				topic:{selectedTopicId};postcode:{initialPostcode ?? ''};known:
				{(knownAgencyIds ?? []).join(',')}
			</div>
		);
	}
}));

describe('NewRequestDialog', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('selects the only available topic and continues to agency selection', async () => {
		apiGetTopicsDataMock.mockResolvedValue([
			{ id: 25, name: 'U25 Suizidprävention' }
		]);

		render(<NewRequestDialog open={true} onClose={() => {}} />);

		await waitFor(() => {
			expect(
				screen.getByTestId('agency-selection').textContent
			).toContain('topic:25');
		});
		expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(
			'25'
		);
	});

	it('passes preselected topic, prefilled postcode and known agencies through', async () => {
		apiGetTopicsDataMock.mockResolvedValue([
			{ id: 25, name: 'U25 Suizidprävention' },
			{ id: 7, name: 'Sozialberatung' }
		]);

		render(
			<NewRequestDialog
				open={true}
				onClose={() => {}}
				preselectedTopicId={7}
				prefilledPostcode="10115"
				knownAgencyIds={[42]}
			/>
		);

		await waitFor(() => {
			expect(screen.getByTestId('agency-selection').textContent).toBe(
				'topic:7;postcode:10115;known:42'
			);
		});
	});

	// #1655: the agency-topics endpoint lists only topics of online centres,
	// so a Träger with one online centre offered a single topic.
	it('offers every topic of the catalogue, not only those of online centres', async () => {
		apiGetTenantAgenciesTopicsMock.mockResolvedValue([
			{ id: 14, name: 'Schulden' }
		]);
		apiGetTopicsDataMock.mockResolvedValue([
			{ id: 14, name: 'Schulden' },
			{ id: 12, name: 'Schwangerschaft' },
			{ id: 3, name: 'Sucht' }
		]);

		render(<NewRequestDialog open={true} onClose={() => {}} />);

		await waitFor(() => {
			expect(
				screen.getAllByRole('option').filter((o) => o.textContent)
			).toHaveLength(3);
		});
	});

	it('names the topics as the registration does, in the reader language', async () => {
		apiGetTopicsDataMock.mockResolvedValue([
			{ id: 14, slug: 'debt', name: 'Schulden' },
			{ id: 12, slug: 'pregnancy', name: 'Schwangerschaft' }
		]);

		render(<NewRequestDialog open={true} onClose={() => {}} />);

		await waitFor(() => {
			expect(
				screen
					.getAllByRole('option')
					.map((o) => o.textContent)
					.filter(Boolean)
			).toEqual(['Debt', 'Pregnancy']);
		});
	});

	// #1655: the success message is portalled below the MUI dialog, so the
	// advice seeker never saw it while the dialog stayed open.
	it('shows the success message instead of keeping it behind the dialog', async () => {
		apiGetTopicsDataMock.mockResolvedValue([
			{ id: 7, name: 'Sozialberatung' }
		]);
		apiPostAdditionalEnquiryMock.mockResolvedValue({ sessionId: 5 });

		render(
			<NewRequestDialog
				open={true}
				onClose={() => {}}
				preselectedTopicId={7}
				prefilledPostcode="10115"
			/>
		);

		const register = await screen.findByRole('button', {
			name: 'profile.data.register.button.label'
		});
		await waitFor(() => expect(register).toHaveProperty('disabled', false));
		register.click();

		expect((await screen.findByTestId('overlay')).textContent).toBe(
			'profile.data.registerSuccess.overlay.headline'
		);
		await waitFor(() =>
			expect(
				screen.queryByText('profile.data.register.dialog.title')
			).toBeNull()
		);
	});
});
