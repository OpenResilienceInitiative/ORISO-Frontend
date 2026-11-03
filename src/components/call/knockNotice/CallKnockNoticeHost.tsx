import * as React from 'react';
import { createPortal } from 'react-dom';
import { CallKnockNotice } from './CallKnockNotice';
import {
	CallKnocksState,
	useCallKnocks,
	UseCallKnocksOptions
} from './useCallKnocks';

export interface CallKnockNoticeHostProps
	extends Omit<UseCallKnocksOptions, 'enabled' | 'scope'> {
	/** The current call; required unless `knocks` is given. */
	scope?: UseCallKnocksOptions['scope'];
	/** The call is minimised: dock the notice above it instead of covering it. */
	minimised?: boolean;
	enabled?: boolean;
	/**
	 * Knocks the caller already polls (for the toolbar count too). Given,
	 * the host does not poll a second time.
	 */
	knocks?: CallKnocksState;
}

/**
 * The knock notice wired to the knock API (ORISO-UserService#1479). Mounted
 * by the call widget for counsellors only.
 *
 * A minimised call is too small (and clips its content) to hold the notice,
 * so it is portalled to the page and docked just above the small call.
 */
export const CallKnockNoticeHost = ({
	minimised = false,
	enabled = true,
	knocks,
	scope = null,
	...options
}: CallKnockNoticeHostProps) => {
	const own = useCallKnocks({
		enabled: enabled && !knocks,
		scope,
		...options
	});
	const { people, busy, admit, decline, admitAll } = knocks ?? own;

	const notice = (
		<CallKnockNotice
			people={people}
			placement={minimised ? 'docked' : 'overlay'}
			busy={busy}
			onAdmit={admit}
			onDecline={decline}
			onAdmitAll={admitAll}
		/>
	);

	return minimised ? createPortal(notice, document.body) : notice;
};
