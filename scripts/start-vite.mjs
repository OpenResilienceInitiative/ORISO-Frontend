import { createRequire } from 'node:module';
import { createProductDevServer } from '../config/vite-product-dev.mjs';
const require = createRequire(import.meta.url);
let owner;
const finish = async () => {
	if (process.env.CI !== 'true') process.stdin.pause();
	try {
		await owner?.close();
		process.exitCode = 0;
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	}
};
try {
	owner = await createProductDevServer();
	for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, finish);
	if (process.env.CI !== 'true') {
		process.stdin.once('end', finish);
		process.stdin.resume();
	}
	console.log(`Starting the development server...\n${owner.url}`);
	if (process.env.BROWSER !== 'none')
		require('react-dev-utils/openBrowser')(owner.url);
} catch (error) {
	console.error(error);
	process.exitCode = 1;
}
