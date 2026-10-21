import { defineConfig } from 'vite';
import storybook from '../../.storybook/main';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
export default defineConfig(async () => {
	const root = process.cwd();
	const cfg = await storybook.viteFinal({}, { configType: 'DEVELOPMENT' });
	return {
		...cfg,
		cacheDir: resolve(
			root,
			'playwright/notification-persistence-1665/.vite-' +
				(process.env.FIXTURE_BASELINE ? 'base' : 'after')
		),
		define: {
			'process.env': JSON.stringify({
				NODE_ENV: 'development',
				REACT_APP_KEYCLOAK_REALM: 'local-synthetic',
				REACT_APP_KEYCLOAK_ORIGIN: 'http://127.0.0.1:9017',
				REACT_APP_API_URL:
					'http://127.0.0.1:' + process.env.FIXTURE_PORT
			})
		},
		server: {
			host: '127.0.0.1',
			port: Number(process.env.FIXTURE_PORT),
			strictPort: true
		},
		plugins: [
			...(cfg.plugins || []),
			{
				name: 'fixture-provider-baseline',
				enforce: 'pre',
				load(id) {
					if (
						process.env.FIXTURE_BASELINE &&
						id ===
							resolve(
								root,
								'src/globalState/provider/NotificationsProvider.tsx'
							)
					)
						return execFileSync(
							'git',
							[
								'show',
								'b527b8bc6fea723b2ca59ec73f57127debb022f9:src/globalState/provider/NotificationsProvider.tsx'
							],
							{ encoding: 'utf8' }
						);
				}
			}
		]
	};
});
