import { useCallback, useMemo, useRef } from 'react';
import { apiPostRegistration } from '../../api/apiPostRegistration';
import { endpoints } from '../../resources/scripts/endpoints';
import { TenantDataInterface } from '../../globalState/interfaces';
import { autoLogin } from './autoLogin';

type RegistrationPayload = Parameters<typeof apiPostRegistration>[1];

/**
 * Registers an asker and logs them in — and, once the account exists, only
 * logs in.
 *
 * `apiPostRegistration` creates the account *and then* logs in, and settles
 * for both together. For screens that generate the User-ID and password
 * themselves (the anonymous chat, the invite link) a failed login after a
 * created account is a trap either way it is handled today: registering again
 * makes a second account for the same person, and the login page does not
 * help because nobody there knows the generated password (#1533). So the
 * second press of the same button tries the login again, with the same
 * credentials, and never registers twice.
 *
 * `accountCreated()` tells the caller which of the two a failure was, so it
 * can say the right thing: "something went wrong, try again" or "your access
 * exists, only the login failed".
 */
export const useRegisterThenLogin = () => {
	const accountCreatedRef = useRef(false);

	const submit = useCallback(
		async (
			data: RegistrationPayload,
			useMultiTenancyWithSingleDomain: boolean,
			tenant: TenantDataInterface
		): Promise<void> => {
			if (accountCreatedRef.current) {
				await autoLogin({
					username: data.username || '',
					password: data.password || '',
					tenantData: tenant
				});
				return;
			}
			await apiPostRegistration(
				endpoints.registerAsker,
				data,
				useMultiTenancyWithSingleDomain,
				tenant,
				() => {
					accountCreatedRef.current = true;
				}
			);
		},
		[]
	);

	const accountCreated = useCallback(() => accountCreatedRef.current, []);

	/* One object for the life of the screen, so callers can list it in their
	   hook dependencies without rebuilding their handlers on every render. */
	return useMemo(
		() => ({ submit, accountCreated }),
		[submit, accountCreated]
	);
};
