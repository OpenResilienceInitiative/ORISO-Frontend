/**
 * Storybook-only helpers for GroupCallWidget stories.
 * Do not import from production app code.
 */
import * as React from 'react';
import { MatrixClientContext } from '../../../globalState/context/MatrixClientContext';
import { callManager } from '../../../services/CallManager';
import { GroupCallWidget } from '../GroupCallWidget';

export const FAKE_ELEMENT_CALL_ROOM_ID =
	'!sb-element-call:matrix.storybook.test';
export const FAKE_SIGNAL_ROOM_ID = '!sb-session:matrix.storybook.test';
export const FAKE_CALL_ID = 'sb-group-call-1';
export const FAKE_CALLER_USER_ID = '@caller:matrix.storybook.test';
export const FAKE_SELF_USER_ID = '@sb-consultant:matrix.storybook.test';
export const FAKE_SELF_DEVICE_ID = 'SBDEVICE01';
export const STORYBOOK_MATRIX_HS = 'https://matrix.storybook.test';

/**
 * Matrix client surface useElementCallWidget touches while it builds the
 * embed URL. It has to be *complete*: an incomplete session (no user or device
 * id) makes prepare() throw, and GroupCallWidget answers a widget error with
 * `alert()` + closeCallSurface() — which silently blanked these stories.
 *
 * `joinPending` is how the Connecting story is held open: the widget awaits
 * `joinRoom` before it has a URL, so a promise that never settles parks the
 * component in its "Setting up call" state without faking any transport.
 */
export const makeFakeMatrixClientService = ({
	joinPending = false
}: { joinPending?: boolean } = {}) => {
	const room = { getMyMembership: () => (joinPending ? 'leave' : 'join') };
	const client = {
		getUserId: () => FAKE_SELF_USER_ID,
		getDeviceId: () => FAKE_SELF_DEVICE_ID,
		getHomeserverUrl: () => STORYBOOK_MATRIX_HS,
		getRoom: () => room,
		joinRoom: () =>
			joinPending
				? new Promise<never>(() => {
						/* intentionally never resolves — Storybook Connecting state */
					})
				: Promise.resolve(room),
		// useElementCallWidget subscribes to timeline and to-device traffic to
		// feed the widget; without these it threw "client.on is not a function".
		on: () => client,
		off: () => client
	};
	return {
		getClient: () => client
	} as any;
};

export const resetCallManager = () => {
	if (callManager.hasActiveCall()) {
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
		() =>
			makeFakeMatrixClientService({ joinPending: mode === 'connecting' }),
		[mode]
	);

	React.useEffect(() => {
		let cancelled = false;

		resetCallManager();
		seedIncomingElementCall();

		if (mode === 'connecting' || mode === 'active') {
			callManager.answerCall();
		}

		if (!cancelled) {
			setReady(true);
		}

		return () => {
			cancelled = true;
			resetCallManager();
			setReady(false);
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
