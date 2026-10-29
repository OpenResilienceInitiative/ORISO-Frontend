import { useCallback, useEffect, useRef, useState } from 'react';
import {
	apiGetCallShareLinkKnock,
	apiSetCallShareLinkKnock,
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
}

export interface CallShareLinkKnockState {
	/** `null` while the call has no share link: then there is nothing to switch. */
	knock: boolean | null;
	/** Resolves with the stored setting; rejects when there is no link or the change did not land. */
	setKnock: (knock: boolean) => Promise<boolean>;
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
	intervalMs = 10_000
}: UseCallShareLinkKnockOptions): CallShareLinkKnockState => {
	const [link, setLink] = useState<CallShareLinkKnock | null>(null);
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
		if (!enabled || !sourceRoomId || !callId) return undefined;
		let stopped = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const tick = () => {
			const asked = landed.current;
			apiRef.current
				.get({ sourceRoomId, callId })
				.then((next) => {
					if (
						!stopped &&
						!writing.current &&
						asked === landed.current
					)
						store(next);
				})
				.catch(() => {
					// The server did not answer: keep what we knew.
				})
				.finally(() => {
					if (!stopped) timer = setTimeout(tick, intervalMs);
				});
		};
		tick();
		return () => {
			stopped = true;
			if (timer) clearTimeout(timer);
		};
	}, [enabled, sourceRoomId, callId, intervalMs]);

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

	return { knock: link ? link.knock : null, setKnock };
};
