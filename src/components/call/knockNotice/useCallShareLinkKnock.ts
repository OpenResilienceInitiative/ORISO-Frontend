import { useCallback, useEffect, useRef, useState } from 'react';
import {
	apiGetCallShareLinkKnock,
	apiSetCallShareLinkKnock,
	isCallNotShareable,
	type CallShareLinkCall,
	type CallShareLinkKnock
} from '../../../api/apiCallShareLinkKnock';

export interface CallShareLinkKnockApi {
	get: (call: CallShareLinkCall) => Promise<CallShareLinkKnock | null>;
	set: (linkId: number, knock: boolean) => Promise<boolean>;
}

const userServiceApi: CallShareLinkKnockApi = {
	get: apiGetCallShareLinkKnock,
	set: apiSetCallShareLinkKnock
};

export interface UseCallShareLinkKnockOptions {
	enabled: boolean;
	/** `null`: no call to ask about, so no link. */
	call: CallShareLinkCall | null;
	api?: CallShareLinkKnockApi;
	/** The share popover may create the link at any time: ask again this often. */
	intervalMs?: number;
	/**
	 * UserService#1662: how often to ask while the server says the call cannot
	 * be shared at all (no binding: a group call a plain member or an advice
	 * seeker started). The first answers may come before the server has
	 * registered the call, so a few tries; then it stops for this call.
	 */
	maxNotShareableTries?: number;
}

export interface CallShareLinkKnockState {
	/** `null` while the call has no share link: then there is nothing to switch. */
	knock: boolean | null;
	/** Resolves with the stored setting; rejects when there is no link or the change did not land. */
	setKnock: (knock: boolean) => Promise<boolean>;
	/**
	 * `false` once the server said, the bounded number of times, that the call
	 * cannot be shared: then nothing offers its link (UserService#1662).
	 */
	shareable: boolean;
}

/**
 * The "Anklopfen" setting of the running call's share link (#1892,
 * ORISO-UserService#1488), for the switch inside the call
 * (ORISO-ElementCall#109). Polls, because the link is made in the share
 * popover and can change there too.
 */
export const useCallShareLinkKnock = ({
	enabled,
	call,
	api = userServiceApi,
	intervalMs = 10_000,
	maxNotShareableTries = 6
}: UseCallShareLinkKnockOptions): CallShareLinkKnockState => {
	const [link, setLink] = useState<CallShareLinkKnock | null>(null);
	const [shareable, setShareable] = useState(true);
	const linkRef = useRef<CallShareLinkKnock | null>(null);
	// Bumped by every change: an older change's answer is stale.
	const version = useRef(0);
	// A poll that overlaps a change may have read the old setting: changes on
	// their way, and changes landed so far.
	const writing = useRef(0);
	const landed = useRef(0);
	const apiRef = useRef(api);
	apiRef.current = api;

	const sourceRoomId = call?.sourceRoomId ?? null;
	const callId = call?.callId ?? null;

	const store = (next: CallShareLinkKnock | null) => {
		linkRef.current = next;
		setLink(next);
	};

	useEffect(() => {
		store(null);
		setShareable(true);
		if (!enabled || !sourceRoomId || !callId) return undefined;
		let stopped = false;
		let notShareable = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const tick = () => {
			const asked = landed.current;
			apiRef.current
				.get({ sourceRoomId, callId })
				.then((next) => {
					notShareable = 0;
					if (!stopped) setShareable(true);
					if (
						!stopped &&
						!writing.current &&
						asked === landed.current
					)
						store(next);
				})
				.catch((error) => {
					// The server did not answer: keep what we knew. A call it
					// cannot share counts towards the bound.
					if (isCallNotShareable(error)) notShareable += 1;
				})
				.finally(() => {
					if (stopped) return;
					if (notShareable >= maxNotShareableTries) {
						store(null);
						setShareable(false);
						return;
					}
					timer = setTimeout(tick, intervalMs);
				});
		};
		tick();
		return () => {
			stopped = true;
			if (timer) clearTimeout(timer);
		};
	}, [enabled, sourceRoomId, callId, intervalMs, maxNotShareableTries]);

	const setKnock = useCallback(async (knock: boolean) => {
		const current = linkRef.current;
		if (!current) throw new Error('No share link for this call');
		const request = ++version.current;
		writing.current += 1;
		try {
			const stored = await apiRef.current.set(current.id, knock);
			// The same link, and no newer change since: take the server's word.
			if (
				request === version.current &&
				linkRef.current?.id === current.id
			)
				store({ id: current.id, knock: stored });
			return stored;
		} finally {
			writing.current -= 1;
			landed.current += 1;
		}
	}, []);

	return { knock: link ? link.knock : null, setKnock, shareable };
};
