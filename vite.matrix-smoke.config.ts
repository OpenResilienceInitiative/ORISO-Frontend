import { defineConfig } from 'vite';
import { createReadStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	plugins: [
		{
			name: 'matrix-smoke-wasm',
			configureServer(server) {
				server.middlewares.use((request, response, next) => {
					if (
						request.url !==
						'/node_modules/.vite/deps/pkg/matrix_sdk_crypto_wasm_bg.wasm'
					) {
						next();
						return;
					}
					response.setHeader('Content-Type', 'application/wasm');
					const root = dirname(fileURLToPath(import.meta.url));
					createReadStream(
						resolve(
							root,
							'node_modules/@matrix-org/matrix-sdk-crypto-wasm/pkg/matrix_sdk_crypto_wasm_bg.wasm'
						)
					).pipe(response);
				});
			}
		}
	]
});
