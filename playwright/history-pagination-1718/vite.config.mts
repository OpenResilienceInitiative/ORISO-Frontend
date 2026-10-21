import { defineConfig } from 'vite';
import storybook from '../../.storybook/main';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig(async () => {
	const config = await storybook.viteFinal({}, { configType: 'DEVELOPMENT' });
	return {
		...config,
		define: {
			'global': 'globalThis',
			'process.env': JSON.stringify({
				NODE_ENV: 'development',
				REACT_APP_KEYCLOAK_REALM: 'history-fixture',
				REACT_APP_API_URL: 'http://127.0.0.1:9021'
			})
		},
		server: { host: '127.0.0.1', port: 9021, strictPort: true },
		plugins: [
			...(config.plugins || []),
			{
				name: 'history-fixture-crypto-wasm',
				configureServer(server) {
					server.middlewares.use((request, response, next) => {
						if (
							!request.url
								?.split('?')[0]
								.endsWith('/matrix_sdk_crypto_wasm_bg.wasm')
						) {
							next();
							return;
						}
						response.setHeader('Content-Type', 'application/wasm');
						createReadStream(
							resolve(
								process.cwd(),
								'node_modules/@matrix-org/matrix-sdk-crypto-wasm/pkg/matrix_sdk_crypto_wasm_bg.wasm'
							)
						).pipe(response);
					});
				}
			}
		]
	};
});
