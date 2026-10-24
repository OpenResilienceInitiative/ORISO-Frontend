// @vitest-environment jsdom
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppConfigProvider } from './AppConfigProvider';
import { appConfig } from '../../utils/appConfig';

vi.mock('../../api/apiFrontendSettings', () => ({
	apiFrontendSettings: vi.fn(async () => ({}))
}));
vi.mock('../../api/apiServerSettings', () => ({
	apiServerSettings: vi.fn(async () => ({}))
}));

describe('AppConfigProvider', () => {
	it('syncs the module-level config before children first render', async () => {
		const seenOnFirstRender: unknown[] = [];
		const Child = () => {
			if (seenOnFirstRender.length === 0)
				seenOnFirstRender.push(appConfig);
			return <span>ready</span>;
		};
		const config = {
			useApiClusterSettings: false,
			releaseToggles: { enableNewNotifications: true }
		} as never;

		render(
			<AppConfigProvider config={config}>
				<Child />
			</AppConfigProvider>
		);

		await screen.findByText('ready');
		expect(seenOnFirstRender[0]).toBe(config);
	});
});
