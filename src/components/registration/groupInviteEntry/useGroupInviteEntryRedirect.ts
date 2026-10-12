import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getValueFromCookie } from '../../sessionCookie/accessSessionCookie';
import {
	buildGroupInviteEntryPath,
	isInviteLoginState,
	shouldOpenGroupInviteEntry
} from './groupInviteEntryState';

/**
 * On `/login?gcid=…&aid=…`: hand a newcomer to the entry screen (#1499). True
 * while that hand-over is due, so the login form is not flashed first.
 */
export const useGroupInviteEntryRedirect = (): boolean => {
	const [searchParams] = useSearchParams();
	const location = useLocation();
	const navigate = useNavigate();
	const gcid = searchParams.get('gcid');
	const aid = searchParams.get('aid');
	const redirecting = shouldOpenGroupInviteEntry({
		gcid,
		aid,
		hasSession: Boolean(getValueFromCookie('keycloak')),
		loginChosen: isInviteLoginState(location.state)
	});

	useEffect(() => {
		if (redirecting) {
			navigate(buildGroupInviteEntryPath(gcid, aid), { replace: true });
		}
	}, [redirecting, gcid, aid, navigate]);

	return redirecting;
};
