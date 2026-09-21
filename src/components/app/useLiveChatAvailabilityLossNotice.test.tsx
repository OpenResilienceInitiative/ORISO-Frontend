// @vitest-environment jsdom
import React, { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { useLiveChatAvailabilityLossNotice } from './useLiveChatAvailabilityLossNotice';
import de from '../../resources/i18n/de/common.json';
import deInformal from '../../resources/i18n/de@informal/common.json';
import en from '../../resources/i18n/en/common.json';

// One `t` per language, so a language switch changes its identity the way
// react-i18next does.
const i18nState = vi.hoisted(() => {
	const translators: Record<string, (key: string) => string> = {};
	return {
		language: 'de',
		t(language: string) {
			translators[language] ??= (key: string) =>
				language === 'de' ? key : `${language}:${key}`;
			return translators[language];
		}
	};
});
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: i18nState.t(i18nState.language) })
}));

/** A provider holding real notification state, like NotificationsProvider. */
const renderNoticeWithState = (lostReason: string | null) => {
	let current: any[] = [];
	let setList: (next: any) => void = () => undefined;
	const Wrapper = ({ children }: { children: React.ReactNode }) => {
		const [notifications, setNotifications] = useState<any[]>([]);
		current = notifications;
		setList = setNotifications;
		return (
			<NotificationsContext.Provider
				value={
					{
						notifications,
						setNotifications,
						addNotification: (notification: any) =>
							setNotifications((list: any[]) =>
								list.some((item) => item.id === notification.id)
									? list
									: [...list, notification]
							),
						removeNotification: (id: string) =>
							setNotifications((list: any[]) =>
								list.filter((item) => item.id !== id)
							)
					} as any
				}
			>
				{children}
			</NotificationsContext.Provider>
		);
	};
	const view = renderHook(
		({ reason }) => useLiveChatAvailabilityLossNotice(reason as any),
		{ wrapper: Wrapper, initialProps: { reason: lostReason } }
	);
	return {
		...view,
		notices: () => current,
		closeNotice: () => act(() => setList([]))
	};
};

const renderNotice = (lostReason: string | null) => {
	const addNotification = vi.fn();
	const removeNotification = vi.fn();
	// Replays each update against a list holding the notice (if one was
	// added), so additions and removals show up as calls.
	let shown: any[] = [];
	const setNotifications = vi.fn((update: (list: any[]) => any[]) => {
		const next = update(shown);
		next.filter((item) => !shown.includes(item)).forEach((item) =>
			addNotification(item)
		);
		shown
			.filter((item) => !next.includes(item))
			.forEach((item) =>
				removeNotification(item.id, item.notificationType)
			);
		shown = next;
	});
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<NotificationsContext.Provider
			value={
				{ addNotification, removeNotification, setNotifications } as any
			}
		>
			{children}
		</NotificationsContext.Provider>
	);
	const view = renderHook(
		({ reason }) => useLiveChatAvailabilityLossNotice(reason as any),
		{ wrapper, initialProps: { reason: lostReason } }
	);
	return { ...view, addNotification, removeNotification };
};

const lookup = (catalogue: unknown, key: string): unknown =>
	key
		.split('.')
		.reduce<any>(
			(node, part) => (node ? node[part] : undefined),
			catalogue
		);

describe('live-chat availability loss notice (#1485)', () => {
	beforeEach(() => {
		i18nState.language = 'de';
	});

	// #1485 review: the notice stays up until closed, so it must follow a
	// language switch instead of keeping the old wording.
	it('rewords the open notice when the language changes', () => {
		const { rerender, notices } = renderNoticeWithState('refused');
		expect(notices()).toEqual([
			expect.objectContaining({
				title: 'profile.functions.liveChat.lost.title'
			})
		]);

		i18nState.language = 'en';
		rerender({ reason: 'refused' });

		expect(notices()).toEqual([
			expect.objectContaining({
				title: 'en:profile.functions.liveChat.lost.title',
				text: 'en:profile.functions.liveChat.lost.refused'
			})
		]);
	});

	it('names the new reason when a second loss follows the first', () => {
		const { rerender, notices } = renderNoticeWithState('leaseLost');

		rerender({ reason: 'connectionLost' });

		expect(notices()).toEqual([
			expect.objectContaining({
				text: 'profile.functions.liveChat.lost.connectionLost'
			})
		]);
	});

	it('does not reopen a closed notice on a language change', () => {
		const { rerender, notices, closeNotice } =
			renderNoticeWithState('refused');
		closeNotice();

		i18nState.language = 'en';
		rerender({ reason: 'refused' });

		expect(notices()).toEqual([]);
	});

	it('stays silent while the counsellor is still counted', () => {
		const { addNotification } = renderNotice(null);
		expect(addNotification).not.toHaveBeenCalled();
	});

	it.each(['refused', 'sessionExpired', 'leaseLost', 'connectionLost'])(
		'tells the counsellor she is no longer reachable and why (%s)',
		(reason) => {
			const { addNotification } = renderNotice(reason);

			expect(addNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'liveChatAvailabilityLost',
					notificationType: 'warning',
					closeable: true,
					title: 'profile.functions.liveChat.lost.title',
					text: `profile.functions.liveChat.lost.${reason}`
				})
			);
		}
	);

	it('withdraws the notice once the counsellor is live again', () => {
		const { rerender, removeNotification } = renderNotice('leaseLost');

		rerender({ reason: null });

		expect(removeNotification).toHaveBeenCalledWith(
			'liveChatAvailabilityLost',
			'warning'
		);
	});

	it('renders without a notifications provider', () => {
		expect(() =>
			renderHook(() => useLiveChatAvailabilityLossNotice('refused'))
		).not.toThrow();
	});

	it.each([
		['de', de],
		['de@informal', deInformal],
		['en', en]
	])('has every notice string in the %s catalogue', (_locale, catalogue) => {
		for (const key of [
			'title',
			'refused',
			'sessionExpired',
			'leaseLost',
			'connectionLost'
		]) {
			expect(
				lookup(catalogue, `profile.functions.liveChat.lost.${key}`)
			).toEqual(expect.any(String));
		}
	});
});
