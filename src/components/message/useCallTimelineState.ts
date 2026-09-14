import * as React from 'react';
import {
	hasSameCallLifecycleIdentity,
	type CallLifecycleMessage
} from '../../utils/callLifecycleMessage';

const REFRESH_DELAY_MS = 15000;

type LoadCallState = (
	call: CallLifecycleMessage
) => Promise<CallLifecycleMessage | null>;

/** Reconcile a durable room card with the authenticated lifecycle state. */
export function useCallTimelineState(
	initialCall: CallLifecycleMessage,
	loadState?: LoadCallState
): CallLifecycleMessage {
	const [stored, setStored] = React.useState<{
		original: CallLifecycleMessage;
		value: CallLifecycleMessage;
	} | null>(null);
	const hasAcceptedTerminal = Boolean(
		stored &&
			hasSameCallLifecycleIdentity(stored.original, initialCall) &&
			stored.value.state !== 'running'
	);
	const call =
		stored &&
		hasSameCallLifecycleIdentity(stored.original, initialCall) &&
		(stored.original === initialCall || stored.value.state !== 'running')
			? stored.value
			: initialCall;

	React.useEffect(() => {
		if (!loadState || hasAcceptedTerminal) return;
		let active = true;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const refresh = async () => {
			let terminal = false;
			try {
				const value = await loadState(initialCall);
				if (!active) return;
				if (
					value &&
					hasSameCallLifecycleIdentity(value, initialCall) &&
					(initialCall.state === 'running' ||
						value.state === initialCall.state ||
						(initialCall.state === 'missed' &&
							value.state === 'ended'))
				) {
					setStored((previous) =>
						previous &&
						hasSameCallLifecycleIdentity(
							previous.original,
							initialCall
						) &&
						previous.value.state !== 'running'
							? previous
							: { original: initialCall, value }
					);
					terminal = value.state !== 'running';
				}
			} catch {
				// Keep the durable room card when the authenticated read is unavailable.
			}
			if (active && !terminal) {
				timer = setTimeout(refresh, REFRESH_DELAY_MS);
			}
		};
		void refresh();
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [hasAcceptedTerminal, initialCall, loadState]);

	return call;
}
