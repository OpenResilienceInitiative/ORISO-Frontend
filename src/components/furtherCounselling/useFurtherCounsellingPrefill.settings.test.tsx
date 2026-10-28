// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { AppConfigProvider } from '../../globalState/provider/AppConfigProvider';
import { SessionsDataContext } from '../../globalState/provider/SessionsDataProvider';
import { config as shippedConfig } from '../../resources/scripts/config';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useFurtherCounsellingPrefill } from './useFurtherCounsellingPrefill';

/* FE#1876: the Admin's postcode setting lives in GET /service/settings as
   { value, readOnly }, like useOverviewPage or calcomUrl. It must reach the
   dialog through the same AppConfigProvider path those settings take. */

const serverSettings = vi.hoisted(() => ({ current: {} as any }));

vi.mock('../../api/apiFrontendSettings', () => ({
	// What the frontend proxy serves at /p/api/settings (proxy/config.js).
	apiFrontendSettings: vi.fn(async () => ({
		proxyPath: '/p',
		registration: { useConsultingTypeSlug: true }
	}))
}));
vi.mock('../../api/apiServerSettings', () => ({
	apiServerSettings: vi.fn(async () => serverSettings.current)
}));

const sessions = [
	{
		session: {
			id: 1,
			postcode: 1234,
			createDate: '2026-10-01T09:00:00Z'
		}
	}
] as any;

const Probe = () => {
	const { prefilledPostcode } = useFurtherCounsellingPrefill();
	const appConfig = useAppConfig();
	return (
		<span>
			{`postcode=${prefilledPostcode ?? 'none'};overview=${String(
				appConfig.useOverviewPage
			)}`}
		</span>
	);
};

const renderWith = (mode: string) => {
	serverSettings.current = {
		furtherCounsellingPostcodeMode: { value: mode, readOnly: false },
		useOverviewPage: { value: true, readOnly: false }
	};
	return render(
		<AppConfigProvider config={{ ...shippedConfig }}>
			<SessionsDataContext.Provider
				value={{ ready: true, sessions, dispatch: () => {} } as any}
			>
				<Probe />
			</SessionsDataContext.Provider>
		</AppConfigProvider>
	);
};

afterEach(cleanup);

describe('further-counselling postcode setting source', () => {
	it('reads the cluster settings in the shipped config', () => {
		// Nothing in the proxy settings or the Helm values overrides this.
		expect(shippedConfig.useApiClusterSettings).toBe(true);
	});

	it('ALWAYS_EMPTY from the server leaves the postcode empty', async () => {
		renderWith('ALWAYS_EMPTY');
		expect(
			await screen.findByText('postcode=none;overview=true')
		).toBeTruthy();
	});

	it('SMART from the server prefills the newest postcode', async () => {
		renderWith('SMART');
		expect(
			await screen.findByText('postcode=01234;overview=true')
		).toBeTruthy();
	});
});
