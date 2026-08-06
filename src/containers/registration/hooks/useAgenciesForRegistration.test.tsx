// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgenciesForRegistration } from './useAgenciesForRegistration';
import { apiAgencySelection } from '../../../api';
import { useAppConfig } from '../../../hooks/useAppConfig';
import {
	ConsultingTypeInterface,
	TopicsDataInterface
} from '../../../globalState/interfaces';

vi.mock('../../../api', () => ({
	apiAgencySelection: vi.fn()
}));

vi.mock('../../../globalState', () => ({
	useTenant: () => null
}));

vi.mock('../../../hooks/useAppConfig', () => ({
	useAppConfig: vi.fn()
}));

vi.mock('./useConsultantRegistrationData', () => ({
	useConsultantRegistrationData: () => ({
		agencies: [],
		consultingTypes: []
	})
}));

vi.mock('../../../globalState/provider/UrlParamsProvider', async () => {
	const ReactModule = await import('react');

	return {
		UrlParamsContext: ReactModule.createContext({
			agency: null,
			consultingType: null,
			consultant: null,
			topic: null,
			loaded: true,
			slugFallback: undefined
		})
	};
});

const topic = { id: 7 } as TopicsDataInterface;

const appConfig = (registration: Record<string, unknown>) =>
	({
		registration: {
			consultingTypeDefaults: {
				// no postcode required so the request fires directly
				autoSelectPostcode: true,
				autoSelectAgency: false
			},
			...registration
		}
	}) as any;

describe('useAgenciesForRegistration consulting type (FE#245)', () => {
	beforeEach(() => {
		vi.mocked(apiAgencySelection).mockResolvedValue([]);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	const lastSearchParams = () =>
		vi.mocked(apiAgencySelection).mock.calls.at(-1)?.[0];

	it('keeps the historic default 1 when nothing is configured', async () => {
		vi.mocked(useAppConfig).mockReturnValue(appConfig({}));

		renderHook(() =>
			useAgenciesForRegistration({ topic, postcode: undefined })
		);

		await waitFor(() => expect(apiAgencySelection).toHaveBeenCalled());
		expect(lastSearchParams()).toMatchObject({
			topicId: 7,
			consultingType: 1
		});
	});

	it('uses the configured default consulting type instead of the hard-coded 1', async () => {
		vi.mocked(useAppConfig).mockReturnValue(
			appConfig({ defaultConsultingTypeId: 5 })
		);

		renderHook(() =>
			useAgenciesForRegistration({ topic, postcode: undefined })
		);

		await waitFor(() => expect(apiAgencySelection).toHaveBeenCalled());
		expect(lastSearchParams()).toMatchObject({ consultingType: 5 });
	});

	it('lets a selected consulting type win over the configured default', async () => {
		vi.mocked(useAppConfig).mockReturnValue(
			appConfig({ defaultConsultingTypeId: 5 })
		);

		renderHook(() =>
			useAgenciesForRegistration({
				topic,
				postcode: undefined,
				consultingType: {
					id: 3,
					registration: {
						autoSelectPostcode: true,
						autoSelectAgency: false
					}
				} as unknown as ConsultingTypeInterface
			})
		);

		await waitFor(() => expect(apiAgencySelection).toHaveBeenCalled());
		expect(lastSearchParams()).toMatchObject({ consultingType: 3 });
	});

	it('respects consulting type id 0 (the old `|| 1` silently replaced it)', async () => {
		vi.mocked(useAppConfig).mockReturnValue(appConfig({}));

		renderHook(() =>
			useAgenciesForRegistration({
				topic,
				postcode: undefined,
				consultingType: {
					id: 0,
					registration: {
						autoSelectPostcode: true,
						autoSelectAgency: false
					}
				} as unknown as ConsultingTypeInterface
			})
		);

		await waitFor(() => expect(apiAgencySelection).toHaveBeenCalled());
		expect(lastSearchParams()).toMatchObject({ consultingType: 0 });
	});
});
