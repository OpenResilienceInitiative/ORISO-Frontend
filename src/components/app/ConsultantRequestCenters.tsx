/**
 * The counsellor's pop-up centres, mounted once beside the app's snackbar
 * host: knocks on group calls and chats (`JoinRequestCenter`) and requests
 * for a new Direkteinladung link (`NewLinkRequestCenter`, #2252). One host,
 * so a further centre is added here and not in `AuthenticatedApp`.
 */
import * as React from 'react';
import { JoinRequestCenter } from '../groupChat/joinRequest/JoinRequestCenter';
import { httpJoinRequestTransport } from '../groupChat/joinRequest/httpJoinRequestTransport';
import { NewLinkRequestCenter } from '../directInvitation/NewLinkRequestCenter';

export const ConsultantRequestCenters = () => (
	<>
		<JoinRequestCenter transport={httpJoinRequestTransport} />
		<NewLinkRequestCenter />
	</>
);
