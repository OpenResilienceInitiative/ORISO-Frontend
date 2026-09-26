import { endpoints } from '../resources/scripts/endpoints';
import { generateCsrfToken } from '../utils/generateCsrfToken';

/** Optional reports must never trigger token refresh, navigation or error toasts. */
export const reportAccountInactivityActivity = async (
	token: string,
	signal: AbortSignal
): Promise<number> => {
	const csrfToken = generateCsrfToken();
	const localHeaders =
		process.env.NODE_ENV === 'development'
			? {
					'X-WHITELIST-HEADER': csrfToken,
					...(process.env.REACT_APP_CSRF_WHITELIST_HEADER_PROPERTY
						? {
								[process.env
									.REACT_APP_CSRF_WHITELIST_HEADER_PROPERTY]:
									csrfToken
							}
						: {})
				}
			: {};
	const response = await fetch(endpoints.accountInactivityActivity, {
		method: 'POST',
		credentials: 'include',
		signal,
		headers: {
			'Authorization': `Bearer ${token}`,
			'X-CSRF-TOKEN': csrfToken,
			...localHeaders
		}
	});
	return response.status;
};
