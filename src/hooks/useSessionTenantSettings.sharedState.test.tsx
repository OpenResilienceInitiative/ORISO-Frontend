// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	TenantContext,
	TenantProvider,
	useTenant
} from '../globalState/provider/TenantProvider';
import { useSessionTenantSettings } from './useSessionTenantSettings';
import { setValueInCookie } from '../components/sessionCookie/accessSessionCookie';

// `../globalState` is a barrel: importing it drags in the animated-illustration
// component, whose lottie player touches a canvas 2d context at module load and
// throws under jsdom. Nothing here renders it.
vi.mock('lottie-react', () => ({ default: () => null }));

const mocks = vi.hoisted(() => ({ apiGetTenantTheming: vi.fn() }));

vi.mock('../api/apiGetTenantTheming', () => ({
	apiGetTenantTheming: mocks.apiGetTenantTheming
}));

/** What the app resolved when the counsellor signed in. */
const RESOLVED_TENANT = {
	id: 14,
	name: 'Blinky Fish Tenant Sep 14',
	theming: { primaryColor: '#004488' },
	content: { claim: 'Wir hören zu' },
	settings: { featureGroupChatV2Enabled: false }
};

const Probe = () => {
	const context = React.useContext(TenantContext);
	const [seeded, setSeeded] = React.useState(false);
	// `setTenant` is stable for the provider's lifetime; the context *value* is
	// not — it is rebuilt whenever the provider renders, so depending on it
	// would re-seed the tenant and undo the refresh under test.
	const setTenant = context.setTenant;
	React.useEffect(() => {
		setTenant(RESOLVED_TENANT as any);
		setSeeded(true);
	}, [setTenant]);

	return seeded ? <SessionProbe /> : null;
};

const SessionProbe = () => {
	useSessionTenantSettings('session-1');
	const tenant = useTenant();
	return (
		<span data-testid="tenant">
			{`${tenant?.name}|${String(
				tenant?.settings?.featureGroupChatV2Enabled
			)}`}
		</span>
	);
};

/** A Keycloak access token as the app stores it: only the payload is read. */
const tokenForTenant = (tenantId: number) =>
	`header.${btoa(JSON.stringify({ tenantId }))}.signature`;

describe('useSessionTenantSettings – one shared tenant state', () => {
	beforeEach(() => {
		cleanup();
		mocks.apiGetTenantTheming.mockReset();
		document.cookie = 'keycloak=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
		window.localStorage.clear();
	});

	it('lets tenant consumers see a permission the Träger admin just enabled', async () => {
		// The admin switched the Gesprächskreis on while the counsellor kept
		// the app open; opening the next conversation re-reads the permissions.
		mocks.apiGetTenantTheming.mockResolvedValue({
			...RESOLVED_TENANT,
			settings: { featureGroupChatV2Enabled: true }
		});

		render(
			<TenantProvider>
				<Probe />
			</TenantProvider>
		);

		await waitFor(() =>
			expect(screen.getByTestId('tenant').textContent).toBe(
				'Blinky Fish Tenant Sep 14|true'
			)
		);
	});

	// The per-session refresh is fetched for whichever Träger was signed in
	// when it started. If the counsellor signs in (or out) meanwhile, that
	// answer describes the *previous* Träger and must not be merged into the
	// current one.
	it('drops a refresh that was fetched for a different tenant', async () => {
		setValueInCookie('keycloak', tokenForTenant(14));
		let resolveRefresh!: (value: unknown) => void;
		mocks.apiGetTenantTheming.mockReturnValue(
			new Promise((resolve) => {
				resolveRefresh = resolve;
			})
		);

		render(
			<TenantProvider>
				<Probe />
			</TenantProvider>
		);
		await waitFor(() =>
			expect(mocks.apiGetTenantTheming).toHaveBeenCalled()
		);

		// The counsellor signs out before the answer arrives.
		act(() => {
			document.cookie =
				'keycloak=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
			setValueInCookie('other', 'x');
		});
		await act(async () => {
			resolveRefresh({
				...RESOLVED_TENANT,
				settings: { featureGroupChatV2Enabled: true }
			});
		});

		expect(screen.getByTestId('tenant').textContent).toBe(
			'Blinky Fish Tenant Sep 14|false'
		);
	});
});
