// @vitest-environment jsdom
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	TenantContext,
	TenantProvider,
	useTenant
} from '../globalState/provider/TenantProvider';
import { useSessionTenantSettings } from './useSessionTenantSettings';

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
	React.useEffect(() => {
		context.setTenant(RESOLVED_TENANT as any);
		setSeeded(true);
	}, [context]);

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

describe('useSessionTenantSettings – one shared tenant state', () => {
	beforeEach(() => {
		mocks.apiGetTenantTheming.mockReset();
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
});
