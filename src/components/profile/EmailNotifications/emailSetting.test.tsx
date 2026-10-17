// @vitest-environment jsdom

import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../../globalState';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import { useSaveEmailSetting } from './emailSetting';

vi.mock('../../../api/apiPatchUserData', () => ({ apiPatchUserData: vi.fn() }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const snapshot = {
	emailNotifications: {
		emailNotificationsEnabled: true,
		settings: {
			appointmentNotificationEnabled: true,
			feedbackNotificationEnabled: true
		}
	},
	emailToggles: []
};

afterEach(() => vi.mocked(apiPatchUserData).mockReset());

describe('useSaveEmailSetting', () => {
	it('keeps both of two rapid changes made before the first reload lands', async () => {
		// The stored blob the server holds; each PATCH replaces it whole.
		let stored = structuredClone(snapshot.emailNotifications);
		const releases: Array<() => void> = [];
		vi.mocked(apiPatchUserData).mockImplementation(
			(body) =>
				new Promise((resolve) => {
					releases.push(() => {
						stored = body.emailNotifications;
						resolve(undefined);
					});
				})
		);
		// The reload never reaches the render: userData stays the old snapshot.
		const reloadUserData = vi.fn(async () => ({
			...snapshot,
			emailNotifications: structuredClone(stored)
		}));
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<UserDataContext.Provider
				value={{ userData: snapshot, reloadUserData } as never}
			>
				{children}
			</UserDataContext.Provider>
		);
		// Two rows, two hook instances — as on the profile page.
		const appointment = renderHook(() => useSaveEmailSetting(), {
			wrapper
		});
		const supervision = renderHook(() => useSaveEmailSetting(), {
			wrapper
		});

		let saves: Promise<boolean>[] = [];
		await act(async () => {
			saves = [
				appointment.result.current(
					{
						kind: 'settings',
						field: 'appointmentNotificationEnabled'
					},
					false
				),
				supervision.result.current(
					{ kind: 'settings', field: 'feedbackNotificationEnabled' },
					false
				)
			];
		});
		// Answer the PATCHes in the order they were sent, as the server would.
		let settled = false;
		void Promise.all(saves).then(() => (settled = true));
		await act(async () => {
			while (!settled) {
				releases.shift()?.();
				await new Promise((resolve) => setTimeout(resolve, 0));
			}
		});

		expect(await Promise.all(saves)).toEqual([true, true]);
		expect(stored.settings).toEqual({
			appointmentNotificationEnabled: false,
			feedbackNotificationEnabled: false
		});
	});
});
