// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PracticeSandbox } from './PracticeSandbox';
import { practiceCounsellorFixture } from './fixtures/practiceCounsellorFixture';
import { useNotificationSettings } from '../hooks/useNotificationSettings';
import { notificationSettingsStore } from '../utils/notificationSettings/store';
import { isSandboxedMatrixClient } from '../services/matrixClientRegistry';
import { createFakeMatrixService } from './fakeMatrix/FakeMatrixService';

afterEach(async () => {
	cleanup();
	await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
	vi.restoreAllMocks();
});

describe('app-wide Matrix singletons in practice mode', () => {
	it('marks the practice client as sandboxed', () => {
		const service = createFakeMatrixService({ rooms: [] });

		expect(isSandboxedMatrixClient(service.getClient())).toBe(true);
		expect(isSandboxedMatrixClient({})).toBe(false);
		expect(isSandboxedMatrixClient(null)).toBe(false);
	});

	it('never attaches the practice client to the notification settings store', () => {
		const attach = vi.spyOn(notificationSettingsStore, 'attachClient');
		const Settings = () => {
			useNotificationSettings();
			return null;
		};

		render(
			<PracticeSandbox counsellor={practiceCounsellorFixture()}>
				<Settings />
			</PracticeSandbox>
		);

		expect(attach).not.toHaveBeenCalled();
	});
});
