import { useContext } from 'react';
import { UserDataContext } from '../globalState/context/UserDataContext';
import {
	AUTHORITIES,
	hasUserAuthority
} from '../globalState/helpers/stateHelpers';
import { useTenant } from '../globalState/provider/TenantProvider';
import { isAskerEmailCollectionAllowed } from '../utils/askerAccountPolicy';

/** The asker restriction does not govern counsellors' own contact details. */
export const useAccountEmailCollectionAllowed = (): boolean => {
	const userData = useContext(UserDataContext)?.userData;
	const tenant = useTenant();
	return (
		Boolean(
			userData &&
				hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
		) || isAskerEmailCollectionAllowed(tenant?.settings)
	);
};
