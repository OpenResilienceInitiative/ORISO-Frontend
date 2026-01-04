// CACHE BUST: 1760919318 - DEBUG VERSION
import { FetchErrorWithOptions, FETCH_ERRORS } from '../../api';
import { endpoints } from '../../resources/scripts/endpoints';
import { LoginData } from '../registration/autoLogin';

export const getKeycloakAccessToken = (
	username: string,
	password: string,
	otp?: string
): Promise<LoginData> =>
	new Promise((resolve, reject) => {
		console.log("🔐 DEBUG: getKeycloakAccessToken called with:", { username, password: password ? "***" : "undefined", otp });
		
		const data = `username=${username}&password=${password}${
			otp ? `&otp=${otp}` : ``
		}&client_id=app&grant_type=password`;
		const url = endpoints.keycloakAccessToken;

		console.log("🔐 DEBUG: Keycloak URL:", url);
		console.log("🔐 DEBUG: Request data:", data.replace(/password=[^&]*/, "password=***"));

		const req = new Request(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'cache-control': 'no-cache'
			},
			credentials: 'include',
			body: data
		});

		console.log("🔐 DEBUG: Making fetch request to Keycloak...");

		fetch(req)
			.then((response) => {
				console.log("🔐 DEBUG: Keycloak response status:", response.status);
				console.log("🔐 DEBUG: Keycloak response headers:", Object.fromEntries(response.headers.entries()));
				
				if (response.status === 200) {
					console.log("🔐 DEBUG: SUCCESS - Processing 200 response");
					response.json().then((data) => {
						console.log("🔐 DEBUG: SUCCESS - Parsed JSON data:", data);
						resolve(data);
					}).catch((jsonError) => {
						console.error("🔐 DEBUG: ERROR - Failed to parse JSON:", jsonError);
						reject(new Error('Failed to parse Keycloak response JSON'));
					});
				} else if (response.status === 400) {
					console.log("🔐 DEBUG: BAD REQUEST - Processing 400 response");
					response.json().then((data) => {
						console.log("🔐 DEBUG: BAD REQUEST - Error data:", data);
						reject(
							new FetchErrorWithOptions(
								FETCH_ERRORS.BAD_REQUEST,
								{
									data
								}
							)
						);
					});
				} else if (response.status === 401) {
					console.log("🔐 DEBUG: UNAUTHORIZED - 401 response");
					console.log("🔐 DEBUG: UNAUTHORIZED - Response text:", response.statusText);
					reject(new Error(FETCH_ERRORS.UNAUTHORIZED));
				} else {
					console.log("🔐 DEBUG: UNEXPECTED STATUS -", response.status);
					reject(new Error(`Unexpected status: ${response.status}`));
				}
			})
			.catch((error) => {
				console.error("🔐 DEBUG: FETCH ERROR:", error);
				reject(new Error('keycloakLogin'));
			});
	});
