import base from './playwright.recovery.config';
export default {
	...base,
	testMatch: 'password-recovery-faults.e2e.spec.ts',
	timeout: 240_000,
	projects: base.projects.filter((project) => project.name === 'chromium')
};
