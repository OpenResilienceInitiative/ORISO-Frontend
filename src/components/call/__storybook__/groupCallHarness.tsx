/**
 * Storybook-only helpers for GroupCallWidget stories.
 * Do not import from production app code.
 */
import * as React from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { MatrixClientContext } from '../../../globalState/context/MatrixClientContext';
import { callManager } from '../../../services/CallManager';
import type { MatrixClientService } from '../../../services/matrixClientService';
import { GroupCallWidget } from '../GroupCallWidget';

export const FAKE_ELEMENT_CALL_ROOM_ID =
	'!sb-element-call:matrix.storybook.test';
export const FAKE_SIGNAL_ROOM_ID = '!sb-session:matrix.storybook.test';
export const FAKE_CALL_ID = 'sb-group-call-1';
export const FAKE_CALLER_USER_ID = '@caller:matrix.storybook.test';
export const FAKE_CURRENT_USER_ID = '@storybook:matrix.storybook.test';
export const FAKE_DEVICE_ID = 'ORISO_STORYBOOK_DEVICE';
export const STORYBOOK_MATRIX_HS = 'https://matrix.storybook.test';

type MatrixListener = (...args: unknown[]) => void;

/** Storybook-only Matrix boundary exercised by the real widget host hook. */
export const makeFakeMatrixClientService = (mode: GroupCallStoryMode) => {
	const listeners = new Map<string, Set<MatrixListener>>();
	const membership = mode === 'connecting' ? 'invite' : 'join';
	const room = {
		getMyMembership: () => membership,
		getLiveTimeline: () => ({
			getState: () => ({ getStateEvents: () => [] })
		})
	};
	const on = (eventName: string, listener: MatrixListener) => {
		const eventListeners = listeners.get(eventName) ?? new Set();
		eventListeners.add(listener);
		listeners.set(eventName, eventListeners);
	};
	const off = (eventName: string, listener: MatrixListener) => {
		listeners.get(eventName)?.delete(listener);
	};
	const client = {
		getUserId: () => FAKE_CURRENT_USER_ID,
		getDeviceId: () => FAKE_DEVICE_ID,
		getHomeserverUrl: () => STORYBOOK_MATRIX_HS,
		getRoom: (roomId: string) =>
			roomId === FAKE_ELEMENT_CALL_ROOM_ID ? room : null,
		joinRoom: () =>
			mode === 'connecting'
				? new Promise<never>(() => {
						/* keep the real host in its connecting state */
					})
				: Promise.resolve(room),
		on,
		off,
		removeListener: off
	} as unknown as MatrixClient;
	return {
		getClient: () => client,
		getHarnessListenerCount: () =>
			Array.from(listeners.values()).reduce(
				(count, eventListeners) => count + eventListeners.size,
				0
			)
	} as unknown as MatrixClientService & {
		getHarnessListenerCount(): number;
	};
};

export const resetCallManager = () => {
	if (callManager.getCurrentCall()) {
		callManager.endCall(false);
	}
};

export const seedIncomingElementCall = () => {
	resetCallManager();
	callManager.receiveCall(
		FAKE_ELEMENT_CALL_ROOM_ID,
		true,
		FAKE_CALL_ID,
		FAKE_CALLER_USER_ID,
		true,
		FAKE_SIGNAL_ROOM_ID,
		true
	);
};

export type GroupCallStoryMode = 'incoming' | 'connecting' | 'active';

type HarnessProps = {
	mode: GroupCallStoryMode;
};

/**
 * Seeds callManager deterministically, provides MatrixClientContext, and
 * renders the real GroupCallWidget. No production backends.
 */
export const GroupCallStoryHarness: React.FC<HarnessProps> = ({ mode }) => {
	const [ready, setReady] = React.useState(false);
	const matrixClientService = React.useMemo(
		() => makeFakeMatrixClientService(mode),
		[mode]
	);

	React.useEffect(() => {
		resetCallManager();
		seedIncomingElementCall();

		if (mode === 'connecting' || mode === 'active') {
			callManager.answerCall();
		}

		setReady(true);

		return () => {
			resetCallManager();
		};
	}, [mode]);

	return (
		<MatrixClientContext.Provider
			value={{
				matrixClientService,
				setMatrixClientService: () => {}
			}}
		>
			<div
				className="group-call-story-harness"
				style={{
					position: 'relative',
					minHeight: '100vh',
					width: '100%',
					background:
						'linear-gradient(160deg, #1a2332 0%, #2d3a4f 55%, #1e2838 100%)'
				}}
				data-story-mode={mode}
			>
				{ready ? <GroupCallWidget /> : null}
			</div>
		</MatrixClientContext.Provider>
	);
};
