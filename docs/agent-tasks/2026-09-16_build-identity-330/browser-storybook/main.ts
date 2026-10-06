import base from '../../../../.storybook/main';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export default {
	...base,
	stories: [path.join(root, 'src/components/stageLayout/BuildIdentity.stories.tsx')],
	staticDirs: [path.join(root, '.storybook/static'), path.join(root, 'public')],
	previewHead: (head: string) => head + readFileSync(path.join(root, '.storybook/preview-head.html'), 'utf8'),
	async viteFinal(config, options) {
		const result = await base.viteFinal(config, options);
		return {
			...result,
			define: {
				...result.define,
				'process.env.REACT_APP_BUILD_COMMIT': JSON.stringify('4e9f0b00dec34f64b0a1ce49f187054f6b7d51dd')
			}
		};
	}
};
