import { endpoints } from '../../resources/scripts/endpoints';
import { appConfig } from '../../utils/appConfig';

export const budibaseLogout = () => {
	const budibaseUrl = appConfig.budibaseUrl;

	return fetch(endpoints.keycloakLogout).then(() =>
		fetch(`${budibaseUrl}/api/global/auth/logout`, {
			headers: {
				'content-type': 'application/x-www-form-urlencoded'
			},
			method: 'POST',
			credentials: 'include'
		}).catch((error) => {
			/* console.error(error); */
		})
	);
};
