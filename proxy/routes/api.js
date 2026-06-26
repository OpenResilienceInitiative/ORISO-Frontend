const { createProxyMiddleware } = require('http-proxy-middleware');

const normalizeTarget = (value) => {
	const trimmed = String(value || '').trim();
	if (!trimmed) {
		return null;
	}
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return trimmed.replace(/\/+$/, '');
	}
	return `https://${trimmed.replace(/\/+$/, '')}`;
};

const resolveRemoteApiTarget = () =>
	normalizeTarget(
		process.env.REACT_APP_DEV_REMOTE_API_URL ||
			process.env.REACT_APP_API_URL ||
			process.env.VITE_API_URL
	);

const resolveRemoteFrontendOrigin = () =>
	normalizeTarget(process.env.REACT_APP_DEV_REMOTE_FRONTEND_ORIGIN);

const shouldVerifyProxyCertificate = () =>
	String(process.env.REACT_APP_DEV_PROXY_SECURE || 'true').toLowerCase() !==
	'false';

const createRemoteProxy = (target) =>
	createProxyMiddleware({
		target,
		changeOrigin: true,
		secure: shouldVerifyProxyCertificate(),
		logLevel: 'warn',
		onProxyReq: (proxyReq) => {
			const remoteFrontendOrigin = resolveRemoteFrontendOrigin();
			if (!remoteFrontendOrigin) {
				return;
			}

			proxyReq.setHeader('Origin', remoteFrontendOrigin);
			proxyReq.setHeader('Referer', `${remoteFrontendOrigin}/`);
		}
	});

module.exports = () => {
	if (process.env.NODE_ENV !== 'development') {
		return [];
	}

	const remoteTarget = resolveRemoteApiTarget();
	if (!remoteTarget) {
		return [];
	}

	const apiProxy = createRemoteProxy(remoteTarget);

	return [
		{
			name: 'dev-api-service-proxy',
			path: '/service',
			middleware: apiProxy
		},
		{
			name: 'dev-api-v1-proxy',
			path: '/api/v1',
			middleware: apiProxy
		},
		{
			// Keycloak OIDC lives on the API host at /auth/realms/...
			name: 'dev-keycloak-auth-proxy',
			path: '/auth',
			middleware: apiProxy
		}
	];
};
