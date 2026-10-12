// @vitest-environment jsdom
import * as React from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TenantContext, TenantProvider } from './TenantProvider';
import { getTenantSettings } from '../../utils/tenantSettingsHelper';

let setTenant: (tenant: any) => void;
let updateTenantSettings: (settings: any) => void;

const Probe = () => {
	const context = React.useContext(TenantContext);
	setTenant = context.setTenant;
	updateTenantSettings = context.updateTenantSettings;
	return null;
};

describe('TenantProvider – the plain-JS settings mirror', () => {
	// Sign-in/sign-out now switches tenants inside one provider. A merging
	// mirror would hand the next counsellor a flag the previous Träger set.
	it('drops the previous tenant settings when a different tenant resolves', () => {
		render(
			<TenantProvider>
				<Probe />
			</TenantProvider>
		);

		act(() =>
			setTenant({
				id: 1,
				settings: {
					featureGroupChatV2Enabled: true,
					featureTeamDiscussionEnabled: true
				}
			})
		);
		expect(getTenantSettings().featureTeamDiscussionEnabled).toBe(true);

		// Tenant 14 does not carry featureTeamDiscussionEnabled at all.
		act(() =>
			setTenant({
				id: 14,
				settings: { featureGroupChatV2Enabled: false }
			})
		);

		expect(
			getTenantSettings().featureTeamDiscussionEnabled
		).toBeUndefined();
		expect(getTenantSettings().featureGroupChatV2Enabled).toBe(false);
	});

	it('keeps merge semantics for a partial permission refresh', () => {
		render(
			<TenantProvider>
				<Probe />
			</TenantProvider>
		);

		act(() =>
			setTenant({
				id: 14,
				settings: {
					featureGroupChatV2Enabled: false,
					featureSupervisionEnabled: true
				}
			})
		);
		act(() => updateTenantSettings({ featureGroupChatV2Enabled: true }));

		expect(getTenantSettings().featureGroupChatV2Enabled).toBe(true);
		expect(getTenantSettings().featureSupervisionEnabled).toBe(true);
	});
});
