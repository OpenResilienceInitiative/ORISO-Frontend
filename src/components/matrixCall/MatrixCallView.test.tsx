// @vitest-environment oriso-jsdom
/**
 * Only counsellors start calls (Frank, 17 Nov 2026). The legacy
 * `/videoanruf/:roomId/:type` view places a native Matrix call that never
 * reaches the call policy, so it may only answer a call that rings; opened
 * without `?answer=true` it must not start one, for anybody.
 */
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

const service = vi.hoisted(() => ({
	startCall: vi.fn(() => new Promise(() => undefined)),
	answerCall: vi.fn(() => new Promise(() => undefined))
}));
vi.mock('../../services/matrixCallService', () => ({
	matrixCallService: service
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../globalState/context/MatrixClientContext', () => ({
	useMatrixClient: () => ({
		matrixClientService: {
			getClient: () => ({ callEventHandler: { calls: new Map() } })
		}
	})
}));

const { MatrixCallView } = await import('./MatrixCallView');

describe('the legacy call view', () => {
	afterEach(() => {
		cleanup();
		service.startCall.mockClear();
		window.history.replaceState({}, '', '/');
	});

	it('never starts a call when opened without an incoming call', () => {
		window.history.replaceState({}, '', '/videoanruf/room/video');

		render(
			<MatrixCallView
				roomId="!room:oriso"
				isVideoCall
				onCallEnd={vi.fn()}
			/>
		);

		expect(service.startCall).not.toHaveBeenCalled();
	});
});
