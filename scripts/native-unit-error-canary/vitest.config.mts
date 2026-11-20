import { fileURLToPath } from 'node:url';
import base from '../../vitest.config.mts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const task = fileURLToPath(new URL('./', import.meta.url));
const projects = base.test?.projects;
if (!Array.isArray(projects)) throw new Error('Unsupported canonical projects');
const units = projects.filter(
	(project) =>
		typeof project === 'object' &&
		project !== null &&
		'test' in project &&
		project.test?.name === 'unit'
);
if (units.length !== 1)
	throw new Error('Expected exactly one canonical unit project');
const unit = units[0];
export default {
	...base,
	root,
	test: {
		...base.test,
		reporters: ['default', './scripts/verification-reporter.mjs', 'json'],
		// Preserve the real unit name/setup/options/default environment. The
		// fixtures' public named docblocks must resolve the installed package.
		projects: [
			{
				...unit,
				test: {
					...unit.test,
					include: [
						`${task}late-observer.test.ts`,
						`${task}proper-cleanup.test.ts`,
						`${task}constructor-fault.test.ts`,
						`${task}constructor-healthy.test.ts`
					]
				}
			}
		]
	}
};
