// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { NewRequestDialog } from './NewRequestDialog';

const apiGetTenantAgenciesTopicsMock = vi.fn();
const apiGetTopicsDataMock = vi.fn();
const apiPostAdditionalEnquiryMock = vi.fn();
const apiPutSessionConsentMock = vi.fn();
const navigateMock = vi.fn();
// What the consent label reports for the selected centre × topic.
let consentTextForLabel: { versionId: number | null } | null = null;
let traegerRenderable = true;

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' }
	})
}));

vi.mock('react-router-dom', () => ({
	useNavigate: () => navigateMock
}));

vi.mock('../../../api/apiPutSessionConsent', () => ({
	apiPutSessionConsent: (...args: unknown[]) =>
		apiPutSessionConsentMock(...args)
}));

vi.mock('../../registration/accountData/DataProtectionConsentLabel', () => ({
	DataProtectionConsentLabel: ({
		agency,
		topic,
		onResolutionChange
	}: any) => {
		React.useEffect(() => {
			onResolutionChange({
				status: 'resolved',
				consentText: consentTextForLabel,
				inputKey: `${agency?.id ?? 'none'}:${topic?.id ?? 'none'}`
			});
		}, [agency?.id, topic?.id, onResolutionChange]);
		return <span>consent sentence</span>;
	}
}));

vi.mock('../../registration/accountData/useTraegerSentenceHtml', () => ({
	useTraegerSentenceHtml: (consentText: unknown) =>
		consentText && traegerRenderable
			? { html: 'träger', authored: 'träger' }
			: null
}));

vi.mock('../../../globalState/provider/LegalLinksProvider', async () => {
	const ReactModule = await import('react');
	return {
		LegalLinksContext: ReactModule.createContext([
			{ registration: true, label: 'privacy', getUrl: () => '/privacy' }
		])
	};
});

vi.mock('../../../globalState', async () => {
	const ReactModule = await import('react');
	return {
		UserDataContext: ReactModule.createContext({
			reloadUserData: () => Promise.resolve()
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
	BUTTON_TYPES: { LINK: 'link', PRIMARY: 'primary', SECONDARY: 'secondary' },
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
		consentTextForLabel = null;
		traegerRenderable = true;
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

	const renderReadyDialog = (props: Record<string, unknown> = {}) => {
		apiGetTopicsDataMock.mockResolvedValue([
			{ id: 7, name: 'Sozialberatung' }
		]);
		render(
			<NewRequestDialog
				open={true}
				onClose={() => {}}
				preselectedTopicId={7}
				prefilledPostcode="10115"
				{...props}
			/>
		);
	};
	const requestButton = () =>
		screen.findByRole('button', {
			name: 'profile.data.register.button.label'
		});

	it('shows the same-topic info above the request button', async () => {
		renderReadyDialog();
		await requestButton();
		expect(
			screen.getByText('furtherCounselling.request.sameTopicInfo')
		).toBeTruthy();
	});

	// FE#1876 / ADR-022 gate 2 moved forward.
	it('slides up the consent first and creates nothing before it is confirmed', async () => {
		renderReadyDialog();
		const request = await requestButton();
		await waitFor(() => expect(request).toHaveProperty('disabled', false));

		expect(screen.queryByRole('checkbox')).toBeNull();
		fireEvent.click(request);

		const checkbox = await screen.findByRole('checkbox');
		expect(screen.getByText('consent sentence')).toBeTruthy();
		expect(apiPostAdditionalEnquiryMock).not.toHaveBeenCalled();
		await waitFor(() => expect(request).toHaveProperty('disabled', true));
		fireEvent.click(request);
		expect(apiPostAdditionalEnquiryMock).not.toHaveBeenCalled();

		fireEvent.click(checkbox);
		await waitFor(() => expect(request).toHaveProperty('disabled', false));
		expect(apiPostAdditionalEnquiryMock).not.toHaveBeenCalled();
	});

	it('creates the enquiry after consent and goes straight into it', async () => {
		apiPostAdditionalEnquiryMock.mockResolvedValue({ sessionId: 5 });
		const onClose = vi.fn();
		const onRequestCreated = vi.fn();
		renderReadyDialog({ onClose, onRequestCreated });
		const request = await requestButton();
		await waitFor(() => expect(request).toHaveProperty('disabled', false));
		fireEvent.click(request);
		fireEvent.click(await screen.findByRole('checkbox'));
		await waitFor(() => expect(request).toHaveProperty('disabled', false));
		fireEvent.click(request);

		await waitFor(() =>
			expect(navigateMock).toHaveBeenCalledWith({
				pathname: '/sessions/user/view/session/5'
			})
		);
		expect(apiPostAdditionalEnquiryMock).toHaveBeenCalledWith(
			1,
			42,
			'10115',
			7
		);
		expect(onRequestCreated).toHaveBeenCalledWith(5);
		expect(onClose).toHaveBeenCalled();
		// No intermediate success overlay any more.
		expect(screen.queryByTestId('overlay')).toBeNull();
		// Platform wording carries no version, so there is nothing to pin.
		expect(apiPutSessionConsentMock).not.toHaveBeenCalled();
	});

	it('pins the consent to the department version that was on screen', async () => {
		consentTextForLabel = { versionId: 31 };
		apiPostAdditionalEnquiryMock.mockResolvedValue({ sessionId: 8 });
		apiPutSessionConsentMock.mockResolvedValue(undefined);
		renderReadyDialog();
		const request = await requestButton();
		await waitFor(() => expect(request).toHaveProperty('disabled', false));
		fireEvent.click(request);
		fireEvent.click(await screen.findByRole('checkbox'));
		await waitFor(() => expect(request).toHaveProperty('disabled', false));
		fireEvent.click(request);

		await waitFor(() =>
			expect(apiPutSessionConsentMock).toHaveBeenCalledWith(8, 31)
		);
		await waitFor(() => expect(navigateMock).toHaveBeenCalled());
	});

	it('keeps the request closed while the legal text is unavailable', async () => {
		renderReadyDialog();
		const request = await requestButton();
		await waitFor(() => expect(request).toHaveProperty('disabled', false));
		// A configured department whose Träger text cannot be rendered.
		consentTextForLabel = { versionId: 4 };
		traegerRenderable = false;
		fireEvent.click(request);
		const checkbox = await screen.findByRole('checkbox');
		expect(
			await screen.findByText('registration.dataProtection.unrenderable')
		).toBeTruthy();
		expect(checkbox).toHaveProperty('disabled', true);
		fireEvent.click(checkbox);
		fireEvent.click(request);
		expect(apiPostAdditionalEnquiryMock).not.toHaveBeenCalled();
	});
});
