// @vitest-environment jsdom
import * as React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { useCaseHandoverResolutionEvents } from './useCaseHandoverResolutionEvents';

const event = (overrides: Record<string, unknown> = {}): any => ({
	id: 'e1',
	eventType: 'case.handover.granted',
	createdAt: '2026-10-28T10:00:00Z',
	...overrides
});

const watch = (notificationFeed: any[]) => {
	const onResolution = vi.fn();
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<NotificationsContext.Provider value={{ notificationFeed } as any}>
			{children}
		</NotificationsContext.Provider>
	);
	renderHook(
		() =>
			useCaseHandoverResolutionEvents({
				actorId: 'c1',
				sessionId: 13,
				requestId: 5,
				enabled: true,
				onResolution
			}),
		{ wrapper }
	);
	return onResolution;
};

describe('useCaseHandoverResolutionEvents (#1888: reads the activity event model)', () => {
	it('resolves on an event for this session and request', () => {
		expect(
			watch([
				event({
					sourceSessionId: '13',
					params: { caseHandoverRequestId: 5 }
				})
			])
		).toHaveBeenCalledTimes(1);
	});

	it('counts an event without a request id (older producers)', () => {
		expect(watch([event({ sourceSessionId: '13' })])).toHaveBeenCalled();
	});

	it('finds the session in params, like every other Timeline reader', () => {
		expect(
			watch([event({ params: { sourceSessionId: 13 } })])
		).toHaveBeenCalled();
	});

	it('ignores another request, also when only the stored path names it', () => {
		expect(
			watch([
				event({
					sourceSessionId: '13',
					actionPath:
						'/sessions/consultant/sessionView/!r:x/13?caseHandoverRequestId=6'
				})
			])
		).not.toHaveBeenCalled();
	});

	it('ignores other sessions and other event types', () => {
		expect(
			watch([
				event({ sourceSessionId: '14' }),
				event({
					id: 'e2',
					eventType: 'case.handover.offer.received',
					sourceSessionId: '13'
				})
			])
		).not.toHaveBeenCalled();
	});
});
