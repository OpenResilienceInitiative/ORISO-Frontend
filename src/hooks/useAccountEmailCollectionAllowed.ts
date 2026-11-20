import { useContext } from 'react';
import { UserDataContext } from '../globalState/context/UserDataContext';
import {
	AUTHORITIES,
	hasUserAuthority
} from '../globalState/helpers/stateHelpers';
import { useTenantState } from '../globalState/provider/TenantProvider';
import {
	hasRestrictedEmailCollection,
	isAskerEmailCollectionAllowed
} from '../utils/askerAccountPolicy';

/** The asker restriction does not govern counsellors' own contact details. */
export const useAccountEmailCollectionAllowed = (): boolean => {
	const userData = useContext(UserDataContext)?.userData;
	const { tenant, isLoading } = useTenantState();
	return (
		Boolean(
			userData &&
				hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
		) ||
		(!isLoading &&
			userData?.isAskerEmailCollectionAllowed !== false &&
			isAskerEmailCollectionAllowed(tenant?.settings) &&
			(!hasRestrictedEmailCollection(tenant?.settings) ||
				userData?.isAskerEmailCollectionAllowed === true))
	);
};
