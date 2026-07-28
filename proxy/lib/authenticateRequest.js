const { createRemoteJWKSet, jwtVerify } = require('jose');

const CONSULTANT_AUTHORITY = 'AUTHORIZATION_CONSULTANT_DEFAULT';

let jwks;

const getKeycloakRealmUrl = () =>
	(process.env.KEYCLOAK_REALM_URL || '').replace(/\/+$/, '');

const getJwks = () => {
	if (jwks) {
		return jwks;
	}

	const realmUrl = getKeycloakRealmUrl();
	if (!realmUrl) {
		throw new Error('KEYCLOAK_REALM_URL is not configured');
	}

	jwks = createRemoteJWKSet(
		new URL(`${realmUrl}/protocol/openid-connect/certs`)
	);
	return jwks;
};

const resetJwksCache = () => {
	jwks = undefined;
};

const extractRoles = (payload) => {
	const realmRoles = payload?.realm_access?.roles || [];
	const resourceRoles = Object.values(payload?.resource_access || {}).flatMap(
		(entry) => entry?.roles || []
	);
	return [...new Set([...realmRoles, ...resourceRoles])];
};

const createAuthenticateRequest = (options = {}) => {
	const resolveJwks = options.getJwks || getJwks;

	return async (req, res, next) => {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const token = authHeader.slice('Bearer '.length).trim();
		if (!token) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		try {
			const { payload } = await jwtVerify(token, resolveJwks(), {
				issuer: getKeycloakRealmUrl() || undefined
			});

			if (!payload.sub) {
				return res.status(401).json({ error: 'Unauthorized' });
			}

			req.authToken = token;
			req.userId = payload.sub;
			req.userRoles = extractRoles(payload);
			req.isConsultant = req.userRoles.includes(CONSULTANT_AUTHORITY);
			return next();
		} catch {
			return res.status(401).json({ error: 'Unauthorized' });
		}
	};
};

const authenticateRequest = createAuthenticateRequest();

module.exports = {
	authenticateRequest,
	createAuthenticateRequest,
	getKeycloakRealmUrl,
	resetJwksCache
};
