import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
	apiCreateCallShareLink,
	apiUpdateCallShareLink,
	type CallShareLink
} from '../../../api/apiCallShareLink';
import { CallShare, type CallShareProps } from './CallShare';
import type { CallShareSettings } from './callShareSettings';

/**
 * Right after joining, the server may not see the counsellor in the call yet
 * (404); ask again a few times before giving up on the button.
 */
export const SHARE_LINK_RETRY_MS = 3000;
const SHARE_LINK_ATTEMPTS = 5;

export interface CallShareForCallProps {
	/** Room of the conversation behind the call (`CallData.signalRoomId`). */
	sourceRoomId: string;
	callId: string;
	layout: CallShareProps['layout'];
}

/**
 * The share button wired to the call's own link (#1794, UserService#1487).
 * No button when the server says the call cannot be shared; a setting the
 * server did not take snaps back to what the link really has.
 */
export const CallShareForCall = ({
	sourceRoomId,
	callId,
	layout
}: CallShareForCallProps) => {
	const [link, setLink] = useState<CallShareLink | null>(null);
	const [settings, setSettings] = useState<CallShareSettings | null>(null);
	// Only the latest change may set the switches; older answers are stale.
	const latest = useRef(0);
	// What the server last confirmed: a failed change falls back to this.
	const confirmed = useRef<CallShareSettings | null>(null);
	const queue = useRef<Promise<void>>(Promise.resolve());
	// Counts calls: answers that belong to an earlier call are dropped.
	const call = useRef(0);

	useEffect(() => {
		let active = true;
		let timer: ReturnType<typeof setTimeout> | undefined;
		call.current += 1;
		// A change still out for the previous call must not hold this one up.
		queue.current = Promise.resolve();
		setLink(null);
		const ask = (attempt: number) =>
			apiCreateCallShareLink({ sourceRoomId, callId }).then((created) => {
				if (!active) return;
				if (!created) {
					if (attempt < SHARE_LINK_ATTEMPTS)
						timer = setTimeout(
							() => ask(attempt + 1),
							SHARE_LINK_RETRY_MS
						);
					return;
				}
				confirmed.current = created.settings;
				setLink(created);
				setSettings(created.settings);
			});
		ask(1);
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [sourceRoomId, callId]);

	if (!link || !settings) return null;

	// One PATCH at a time, so an older change can never land after a newer one.
	// A change replaced before it was sent is skipped: the newer one carries both
	// switches.
	const change = (next: CallShareSettings) => {
		const request = ++latest.current;
		const forCall = call.current;
		setSettings(next);
		queue.current = queue.current.then(() => {
			if (request !== latest.current || forCall !== call.current) return;
			return apiUpdateCallShareLink(link.id, next)
				.then((saved) => {
					if (forCall !== call.current) return;
					confirmed.current = saved;
					if (request === latest.current) setSettings(saved);
				})
				.catch(() => {
					if (forCall === call.current && request === latest.current)
						setSettings(confirmed.current);
				});
		});
	};

	return (
		<CallShare
			link={link.url}
			layout={layout}
			settings={settings}
			onSettingsChange={change}
			temporaryAccountAllowed={link.temporaryAccountAllowed}
		/>
	);
};
