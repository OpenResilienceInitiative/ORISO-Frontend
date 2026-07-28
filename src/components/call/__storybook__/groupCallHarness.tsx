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
export const STORYBOOK_MATRIX_HS = 'https://matrix.storybook.test';

/** Minimal Matrix client surface GroupCallWidget.setupElementCall touches. */
export const makeFakeMatrixClientService = () => {
	const client = {
		getUserId: () => undefined as string | undefined,
		getHomeserverUrl: () => STORYBOOK_MATRIX_HS
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

/**
 * Hold setupElementCall in-flight by never resolving the token endpoint.
 * Restores the previous fetch on dispose.
 */
export const installTokenFetchDelay = (): (() => void) => {
	const previousFetch = globalThis.fetch.bind(globalThis);

	globalThis.fetch = (async (
		input: RequestInfo | URL,
		init?: RequestInit
	) => {
		const href =
			typeof input === 'string'
				? input
				: input instanceof URL
					? input.href
					: input instanceof Request
						? input.url
						: String(input);

		if (href.includes('/service/matrix/me/token')) {
			return new Promise<Response>(() => {
				/* intentionally never resolves — Storybook Connecting state */
			});
		}

		return previousFetch(input, init);
	}) as typeof fetch;

	return () => {
		globalThis.fetch = previousFetch;
	};
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
		() => makeFakeMatrixClientService(),
		[]
	);

	React.useEffect(() => {
		let restoreFetch: (() => void) | undefined;
		let cancelled = false;

		resetCallManager();

		if (mode === 'connecting') {
			restoreFetch = installTokenFetchDelay();
		}

		seedIncomingElementCall();

		if (mode === 'connecting' || mode === 'active') {
			callManager.answerCall();
		}

		if (!cancelled) {
			setReady(true);
		}

		return () => {
			cancelled = true;
			restoreFetch?.();
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
