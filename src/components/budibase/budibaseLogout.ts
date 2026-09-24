import { endpoints } from '../../resources/scripts/endpoints';
import { appConfig } from '../../utils/appConfig';

export const budibaseLogout = (signal?: AbortSignal) => {
	const budibaseUrl = appConfig.budibaseUrl;

	return fetch(endpoints.keycloakLogout, { signal }).then(() =>
		fetch(`${budibaseUrl}/api/global/auth/logout`, {
			headers: {
				'content-type': 'application/x-www-form-urlencoded'
			},
			method: 'POST',
			credentials: 'include',
			signal
		}).catch((error) => {
			/* console.error(error); */
		})
	);
};
