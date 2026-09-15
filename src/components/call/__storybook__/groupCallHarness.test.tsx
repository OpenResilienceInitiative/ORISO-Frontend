// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MatrixClientContext } from '../../../globalState/context/MatrixClientContext';
import { callManager } from '../../../services/CallManager';
import { GroupCallWidget } from '../GroupCallWidget';
import {
	FAKE_CALL_ID,
	FAKE_ELEMENT_CALL_ROOM_ID,
	FAKE_SIGNAL_ROOM_ID,
	GroupCallStoryHarness,
	makeFakeMatrixClientService,
	resetCallManager,
	seedIncomingElementCall
} from './groupCallHarness';

const widgetApiMocks = vi.hoisted(() => ({
	instances: [] as Array<{ stop: ReturnType<typeof vi.fn> }>
}));

vi.mock('matrix-widget-api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('matrix-widget-api')>();
	return {
		...actual,
		MatrixWidgetType: { Custom: 'm.custom' },
		Widget: class {},
		ClientWidgetApi: class {
			public readonly transport = {
				reply: vi.fn(),
				send: vi.fn().mockResolvedValue({})
			};
			public readonly setViewedRoomId = vi.fn();
			public readonly updateTheme = vi.fn().mockResolvedValue({});
			public readonly feedEvent = vi.fn().mockResolvedValue(undefined);
			public readonly feedToDevice = vi.fn().mockResolvedValue(undefined);
			public readonly feedStateUpdate = vi
				.fn()
				.mockResolvedValue(undefined);
			public readonly on = vi.fn();
			public readonly stop = vi.fn();

			public constructor() {
				widgetApiMocks.instances.push(this);
			}
		}
	};
});

vi.mock('../../../resources/scripts/runtimeConfig', () => ({
	getElementCallBaseUrl: () => 'https://call.storybook.test'
}));

describe('GroupCallWidget Storybook harness', () => {
	const listenerCount = (matrixClientService: unknown) =>
		(
			matrixClientService as {
				getHarnessListenerCount(): number;
			}
		).getHarnessListenerCount();

	beforeEach(() => {
		widgetApiMocks.instances.length = 0;
		resetCallManager();
	});

	afterEach(() => {
		callManager.endCall(false);
	});

	it('leaves locally, tears down listeners and widget API, then clears retained metadata', async () => {
		const matrixClientService = makeFakeMatrixClientService('active');
		seedIncomingElementCall();
		callManager.answerCall();

		const view = render(
			<MatrixClientContext.Provider
				value={{
					matrixClientService,
					setMatrixClientService: () => {}
				}}
			>
				<GroupCallWidget />
			</MatrixClientContext.Provider>
		);

		await waitFor(() => {
			expect(
				view.container.querySelector('.element-call-iframe')
			).toBeTruthy();
		});
		expect(listenerCount(matrixClientService)).toBe(4);

		fireEvent.click(view.getByRole('button', { name: 'Close call' }));

		expect(callManager.getCurrentCall()).toEqual(
			expect.objectContaining({
				callId: FAKE_CALL_ID,
				roomId: FAKE_ELEMENT_CALL_ROOM_ID,
				signalRoomId: FAKE_SIGNAL_ROOM_ID,
				isGroup: true,
				state: 'left'
			})
		);
		expect(callManager.hasActiveCall()).toBe(false);

		view.unmount();

		expect(listenerCount(matrixClientService)).toBe(0);
		expect(widgetApiMocks.instances).toHaveLength(1);
		expect(widgetApiMocks.instances[0].stop).toHaveBeenCalled();

		resetCallManager();
		expect(callManager.getCurrentCall()).toBeNull();
	});

	it('moves all subscriptions to a fresh client and cleans up on unmount', async () => {
		const firstService = makeFakeMatrixClientService('active');
		const nextService = makeFakeMatrixClientService('connecting');
		seedIncomingElementCall();
		callManager.answerCall();

		const renderWidget = (matrixClientService: typeof firstService) => (
			<MatrixClientContext.Provider
				value={{
					matrixClientService,
					setMatrixClientService: () => {}
				}}
			>
				<GroupCallWidget />
			</MatrixClientContext.Provider>
		);
		const view = render(renderWidget(firstService));

		await waitFor(() => expect(listenerCount(firstService)).toBe(4));
		view.rerender(renderWidget(nextService));
		await waitFor(() => {
			expect(listenerCount(firstService)).toBe(0);
			expect(listenerCount(nextService)).toBe(4);
		});
		expect(widgetApiMocks.instances[0].stop).toHaveBeenCalled();

		view.unmount();

		expect(listenerCount(nextService)).toBe(0);
		resetCallManager();
		expect(callManager.getCurrentCall()).toBeNull();
	});

	it('clears retained local-leave metadata when the actual harness unmounts', async () => {
		const view = render(<GroupCallStoryHarness mode="active" />);

		await waitFor(() => {
			expect(
				view.container.querySelector('.element-call-iframe')
			).toBeTruthy();
		});
		fireEvent.click(view.getByRole('button', { name: 'Close call' }));
		expect(callManager.getCurrentCall()).toEqual(
			expect.objectContaining({
				callId: FAKE_CALL_ID,
				state: 'left',
				isGroup: true
			})
		);

		view.unmount();

		expect(callManager.getCurrentCall()).toBeNull();
	});

	it('reseeds the actual harness without carrying active UI across modes', async () => {
		const view = render(<GroupCallStoryHarness mode="active" />);

		await waitFor(() => {
			expect(
				view.container.querySelector('.element-call-iframe')
			).toBeTruthy();
		});
		view.rerender(<GroupCallStoryHarness mode="connecting" />);
		await waitFor(() => {
			expect(
				view.container.querySelector('.connecting-popup')
			).toBeTruthy();
			expect(
				view.container.querySelector('.element-call-iframe')
			).toBeFalsy();
		});
		expect(widgetApiMocks.instances[0].stop).toHaveBeenCalled();

		view.unmount();
		expect(callManager.getCurrentCall()).toBeNull();
	});
});
