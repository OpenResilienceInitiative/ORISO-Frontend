import * as React from 'react';
import { WaitingRoomFrame } from '../../waitingRoom/WaitingRoomFrame';
import {
	RegistrationHandover,
	RegistrationHandoverProps
} from './RegistrationHandover';

/**
 * The handover after the document load that follows registering, in the one
 * waiting-room frame the registration side and the entry rooms use. The red
 * stage, partner logos and legal links stay put, so the reload no longer swaps
 * the page (#1219, #1735; Frank, 2026-10-15). The stage does not replay its
 * intro: the person has already watched it on the form.
 */
export const PostRegistrationHandover = (props: RegistrationHandoverProps) => (
	<WaitingRoomFrame>
		<RegistrationHandover {...props} />
	</WaitingRoomFrame>
);
