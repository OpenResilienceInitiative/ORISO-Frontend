import { endpoints } from '../resources/scripts/endpoints';
import { getValueFromCookie } from '../components/sessionCookie/accessSessionCookie';

export const apiKeycloakLogout = async (): Promise<Response | null> => {
	const refreshToken = getValueFromCookie('refreshToken');
	if (!refreshToken) {
		return null;
	}

	const accessToken = getValueFromCookie('keycloak');
	const body = new URLSearchParams({
		client_id: 'app',
		refresh_token: refreshToken
	});
	const headers: Record<string, string> = {
		'Content-Type': 'application/x-www-form-urlencoded'
	};

	if (accessToken) {
		headers.Authorization = `Bearer ${accessToken}`;
	}

	return fetch(
		new Request(endpoints.keycloakLogout, {
			method: 'POST',
			headers,
			credentials: 'include',
			body: body.toString()
		})
	);
};
