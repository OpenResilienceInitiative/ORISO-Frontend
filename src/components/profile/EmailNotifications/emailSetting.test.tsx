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

		let saves: Promise<{ saved: boolean }>[] = [];
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

		expect((await Promise.all(saves)).map((r) => r.saved)).toEqual([
			true,
			true
		]);
		expect(stored.settings).toEqual({
			appointmentNotificationEnabled: false,
			feedbackNotificationEnabled: false
		});
	});
	const renderSave = (reloadUserData: () => Promise<unknown>) =>
		renderHook(() => useSaveEmailSetting(), {
			wrapper: ({ children }: { children: React.ReactNode }) => (
				<UserDataContext.Provider
					value={{ userData: snapshot, reloadUserData } as never}
				>
					{children}
				</UserDataContext.Provider>
			)
		}).result.current;

	it('builds on a stored change even when the reload after it failed', async () => {
		vi.mocked(apiPatchUserData).mockResolvedValue(undefined);
		const reload = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			// Later reloads succeed (and drain the shared queue state).
			.mockResolvedValue(undefined);
		const save = renderSave(reload);
		let first: { saved: boolean } | undefined;
		await act(async () => {
			first = await save(
				{ kind: 'settings', field: 'appointmentNotificationEnabled' },
				false
			);
		});
		expect(first?.saved).toBe(true);
		// userData is still the old snapshot: the next PATCH must keep the change.
		await act(async () => {
			await save(
				{ kind: 'settings', field: 'feedbackNotificationEnabled' },
				false
			);
		});
		expect(
			vi.mocked(apiPatchUserData).mock.calls[1][0].emailNotifications
				.settings
		).toEqual({
			appointmentNotificationEnabled: false,
			feedbackNotificationEnabled: false
		});
	});

	it('lets fresher user data win over the snapshot kept after a failed reload', async () => {
		vi.mocked(apiPatchUserData).mockResolvedValue(undefined);
		const reload = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue(undefined);
		let userData: typeof snapshot = snapshot;
		const hook = renderHook(() => useSaveEmailSetting(), {
			wrapper: ({ children }: { children: React.ReactNode }) => (
				<UserDataContext.Provider
					value={{ userData, reloadUserData: reload } as never}
				>
					{children}
				</UserDataContext.Provider>
			)
		});
		await act(async () => {
			await hook.result.current(
				{ kind: 'settings', field: 'appointmentNotificationEnabled' },
				false
			);
		});
		// Later, fresher data arrives (Fachaustausch switched off elsewhere).
		userData = {
			...snapshot,
			emailNotifications: {
				emailNotificationsEnabled: true,
				settings: {
					appointmentNotificationEnabled: false,
					feedbackNotificationEnabled: false
				}
			}
		};
		hook.rerender();
		await act(async () => {
			await hook.result.current(
				{ kind: 'path', name: 'emailNotificationsEnabled' },
				false
			);
		});
		expect(vi.mocked(apiPatchUserData).mock.calls[1][0]).toEqual({
			emailNotifications: {
				emailNotificationsEnabled: false,
				settings: {
					appointmentNotificationEnabled: false,
					feedbackNotificationEnabled: false
				}
			}
		});
	});

	it('still resolves false when the PATCH and the reload both fail', async () => {
		vi.mocked(apiPatchUserData).mockRejectedValue(new Error('offline'));
		const save = renderSave(
			vi
				.fn()
				.mockRejectedValueOnce(new Error('offline'))
				.mockResolvedValue(undefined)
		);
		let result: { saved: boolean; stored: boolean } | undefined;
		await act(async () => {
			result = await save(
				{ kind: 'settings', field: 'appointmentNotificationEnabled' },
				false
			);
		});
		expect(result).toEqual({ saved: false, stored: true });
		// Drain the shared queue state for later tests.
		vi.mocked(apiPatchUserData).mockResolvedValue(undefined);
		await act(async () => {
			await save(
				{ kind: 'settings', field: 'appointmentNotificationEnabled' },
				true
			);
		});
	});
});
