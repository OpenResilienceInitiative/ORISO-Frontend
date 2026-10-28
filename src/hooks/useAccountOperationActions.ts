import { accountOperationOwner } from '../utils/accountOperationOwner';
import { getValueFromCookie } from '../components/sessionCookie/accessSessionCookie';
import { useRef } from 'react';
import { AccountOperationActions } from '../utils/accountOperationIntent';

/** The mounted form owns pending/unknown actions; nothing enters storage. */
export const useAccountOperationActions = () => {
	const actions = useRef<AccountOperationActions | null>(null);
	if (!actions.current)
		actions.current = new AccountOperationActions(() =>
			accountOperationOwner(getValueFromCookie('keycloak'))
		);
	return actions.current;
};
