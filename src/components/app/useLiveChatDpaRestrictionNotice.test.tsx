// @vitest-environment jsdom
import React, { useState } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { apiGetNewCounsellingAllowed } from '../../api/apiSetLiveChatAvailability';
import { useLiveChatDpaRestrictionNotice } from './useLiveChatDpaRestrictionNotice';
import de from '../../resources/i18n/de/common.json';
import deInformal from '../../resources/i18n/de@informal/common.json';
import en from '../../resources/i18n/en/common.json';
import fr from '../../resources/i18n/fr/common.json';
import ru from '../../resources/i18n/ru/common.json';
import ti from '../../resources/i18n/ti/common.json';
import tr from '../../resources/i18n/tr/common.json';

// react-i18next hands out a stable `t`; a new one per render would loop the effect.
const t = vi.hoisted(() => (key: string) => key);
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t })
}));
vi.mock('../../api/apiSetLiveChatAvailability', () => ({
	apiGetNewCounsellingAllowed: vi.fn()
}));

/** A provider holding real notification state, like NotificationsProvider. */
const renderNotice = (live: boolean) => {
	let current: any[] = [];
	const Wrapper = ({ children }: { children: React.ReactNode }) => {
		const [notifications, setNotifications] = useState<any[]>([]);
		current = notifications;
		return (
			<NotificationsContext.Provider
				value={{ notifications, setNotifications } as any}
			>
				{children}
			</NotificationsContext.Provider>
		);
	};
	const view = renderHook(
		({ isLive }) => useLiveChatDpaRestrictionNotice(isLive),
		{ wrapper: Wrapper, initialProps: { isLive: live } }
	);
	return { ...view, notices: () => current };
};

afterEach(() => {
	vi.clearAllMocks();
});

describe('useLiveChatDpaRestrictionNotice (#1704)', () => {
	it('warns a live consultant when the agreement blocks new counselling', async () => {
		vi.mocked(apiGetNewCounsellingAllowed).mockResolvedValue(false);

		const { notices } = renderNotice(true);

		await waitFor(() => expect(notices()).toHaveLength(1));
		expect(notices()[0]).toMatchObject({
			id: 'liveChatNewCounsellingRestricted',
			notificationType: 'warning',
			closeable: true,
			title: 'profile.functions.liveChat.dpaRestricted.title',
			text: 'profile.functions.liveChat.dpaRestricted.text'
		});
	});

	it('stays silent when new counselling is allowed or unknown', async () => {
		vi.mocked(apiGetNewCounsellingAllowed)
			.mockResolvedValueOnce(true)
			.mockResolvedValueOnce(null);

		const allowed = renderNotice(true);
		const unknown = renderNotice(true);

		await waitFor(() =>
			expect(apiGetNewCounsellingAllowed).toHaveBeenCalledTimes(2)
		);
		await act(async () => undefined);
		expect(allowed.notices()).toEqual([]);
		expect(unknown.notices()).toEqual([]);
	});

	it('does not ask the server while the consultant is not live', async () => {
		const { notices } = renderNotice(false);

		await act(async () => undefined);
		expect(apiGetNewCounsellingAllowed).not.toHaveBeenCalled();
		expect(notices()).toEqual([]);
	});

	it('removes the warning once the consultant switches live chat off', async () => {
		vi.mocked(apiGetNewCounsellingAllowed).mockResolvedValue(false);
		const { notices, rerender } = renderNotice(true);
		await waitFor(() => expect(notices()).toHaveLength(1));

		rerender({ isLive: false });

		await waitFor(() => expect(notices()).toEqual([]));
	});

	it('has the warning text in every language', () => {
		for (const locale of [de, deInformal, en, fr, ru, ti, tr]) {
			const texts = (locale as any).profile.functions.liveChat
				.dpaRestricted;
			expect(texts.title).toBeTruthy();
			expect(texts.text).toBeTruthy();
		}
	});
});
