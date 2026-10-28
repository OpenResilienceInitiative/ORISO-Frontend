import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
	apiCreateCallShareLink,
	apiUpdateCallShareLink,
	type CallShareLink
} from '../../../api/apiCallShareLink';
import { CallShare, type CallShareProps } from './CallShare';
import type { CallShareSettings } from './callShareSettings';

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

	useEffect(() => {
		let active = true;
		setLink(null);
		apiCreateCallShareLink({ sourceRoomId, callId }).then((created) => {
			if (!active) return;
			setLink(created);
			setSettings(created?.settings ?? null);
		});
		return () => {
			active = false;
		};
	}, [sourceRoomId, callId]);

	if (!link || !settings) return null;

	const change = (next: CallShareSettings) => {
		const previous = settings;
		const request = ++latest.current;
		setSettings(next);
		apiUpdateCallShareLink(link.id, next)
			.then((saved) => request === latest.current && setSettings(saved))
			.catch(() => request === latest.current && setSettings(previous));
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
