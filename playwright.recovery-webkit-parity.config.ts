import base from './playwright.recovery.config';

// Run only the three fault/lifecycle gates and two bounded negative-login gates.
// No Admin settings mutation or repeated broad history suite in this batch.
export default {
	...base,
	testMatch: [
		'password-recovery-faults.e2e.spec.ts',
		'password-recovery.e2e.spec.ts'
	],
	grep: /(failed finalization|same-context logout|backup fails after|negative gate:)/,
	timeout: 240_000,
	projects: base.projects.filter((project) => project.name === 'webkit')
};
