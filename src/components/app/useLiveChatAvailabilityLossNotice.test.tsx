// @vitest-environment jsdom
import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { useLiveChatAvailabilityLossNotice } from './useLiveChatAvailabilityLossNotice';
import de from '../../resources/i18n/de/common.json';
import deInformal from '../../resources/i18n/de@informal/common.json';
import en from '../../resources/i18n/en/common.json';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const renderNotice = (lostReason: string | null) => {
	const addNotification = vi.fn();
	const removeNotification = vi.fn();
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<NotificationsContext.Provider
			value={{ addNotification, removeNotification } as any}
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
