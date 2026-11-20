import { useEffect, useState } from 'react';
import {
	getConversionStatus,
	type ConversionState
} from './liveChatConversionApi';

/**
 * US#1601: account states in which the Live Chat identity is a lasting account
 * the person can sign in to again. Such an account is no longer a guest: its
 * chat must not be finished on sign-out and the guest gates (name choice,
 * waiting room) do not apply to it after a fresh sign-in.
 *
 * `PROMOTION_PENDING` is deliberately not lasting yet: the password has not
 * been confirmed, so the person cannot sign in again.
 */
const LASTING_STATES: ReadonlySet<ConversionState> = new Set<ConversionState>([
	'PROMOTED',
	'ALREADY_REGISTERED'
]);

export const isLastingConversionState = (state: ConversionState): boolean =>
	LASTING_STATES.has(state);

/**
 * Asks the server whether the signed-in Live Chat identity is a lasting
 * account. `null` when that cannot be told (request failed, malformed answer,
 * or the answer belongs to another user than `expectedUserId`).
 */
export const fetchIsLastingLiveChatAccount = async (
	expectedUserId?: string
): Promise<boolean | null> => {
	try {
		const status = await getConversionStatus();
		if (expectedUserId && status.userId !== expectedUserId) return null;
		return isLastingConversionState(status.state);
	} catch {
		return null;
	}
};

/**
 * The server's answer for the signed-in user while `enabled`; `null` while it
 * is unknown. An answer for a previous user is never returned.
 */
export const useLastingLiveChatAccount = (
	enabled: boolean,
	userId: string | undefined
): boolean | null => {
	const [answer, setAnswer] = useState<{
		userId: string;
		lasting: boolean | null;
	} | null>(null);

	useEffect(() => {
		if (!enabled || !userId) return;
		let active = true;
		void fetchIsLastingLiveChatAccount(userId).then((lasting) => {
			if (active) setAnswer({ userId, lasting });
		});
		return () => {
			active = false;
		};
	}, [enabled, userId]);

	return enabled && userId && answer?.userId === userId
		? answer.lasting
		: null;
};
