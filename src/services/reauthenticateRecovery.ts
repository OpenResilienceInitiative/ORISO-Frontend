import { getKeycloakAccessToken } from '../components/sessionCookie/getKeycloakAccessToken';
import { getValueFromCookie } from '../components/sessionCookie/accessSessionCookie';
import { parseJwt } from '../utils/parseJWT';

/** Validate the password/required OTP against the current identity without replacing its Matrix client. */
export const reauthenticateRecovery = async (
	password: string,
	otp?: string
): Promise<void> => {
	const current = parseJwt(getValueFromCookie('keycloak'));
	if (!current.sub || !current.preferred_username)
		throw new Error('Authentication required');
	const response = await getKeycloakAccessToken(
		encodeURIComponent(current.preferred_username),
		encodeURIComponent(password),
		otp ? encodeURIComponent(otp) : undefined
	);
	const authenticated = parseJwt(response.access_token ?? '');
	if (
		authenticated.sub !== current.sub ||
		parseJwt(getValueFromCookie('keycloak')).sub !== current.sub
	)
		throw new Error('Authentication identity changed');
};
