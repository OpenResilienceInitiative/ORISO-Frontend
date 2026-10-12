import { appConfig } from '../../utils/appConfig';

export const calcomLogout = (signal?: AbortSignal) => {
	const calcomUrl = appConfig.calcomUrl;

	return fetch(`${calcomUrl}/api/auth/csrf`, {
		headers: {
			'content-type': 'application/x-www-form-urlencoded'
		},
		method: 'GET',
		credentials: 'include',
		signal
	})
		.then((response) => response.json())
		.then(({ csrfToken }) =>
			fetch(`${calcomUrl}/api/auth/signout`, {
				headers: {
					'content-type': 'application/x-www-form-urlencoded'
				},
				body: `csrfToken=${csrfToken}`,
				method: 'POST',
				credentials: 'include',
				signal
			})
		);
};
