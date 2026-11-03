// @vitest-environment node
// Prepared during the source-only lease interval; execution/red is pending.
import { describe, expect, it } from 'vite-plus/test';
import { ESLint } from 'eslint';

const accessibility = [
	'alt-text',
	'anchor-has-content',
	'anchor-is-valid',
	'aria-activedescendant-has-tabindex',
	'aria-props',
	'aria-proptypes',
	'aria-role',
	'aria-unsupported-elements',
	'heading-has-content',
	'iframe-has-title',
	'img-redundant-alt',
	'no-access-key',
	'no-distracting-elements',
	'no-redundant-roles',
	'role-has-required-aria-props',
	'role-supports-aria-props',
	'scope'
];
const eslint = () => new ESLint({ cache: false });
const rules = async (source: string, filePath: string) => {
	const results = await eslint().lintText(source, { filePath });
	return results.flatMap((result) =>
		result.messages.map((message) => message.ruleId)
	);
};

describe('bounded verification lint coverage', () => {
	it.each([
		'src/components/message/SystemMessage.tsx',
		'src/test/control.stories.tsx',
		'src/test/control.test.tsx'
	])('preserves all17existing accessibility rules for %s', async (file) => {
		const config = await eslint().calculateConfigForFile(file);
		for (const rule of accessibility) {
			const value = config.rules[`jsx-a11y/${rule}`];
			expect([1, 'warn']).toContain(
				Array.isArray(value) ? value[0] : value
			);
		}
	});
	it('rejects an unhandled async query and waitFor in a test', async () => {
		const found = await rules(
			`import { screen, waitFor } from '@testing-library/react';
			screen.findByRole('button'); waitFor(() => {});`,
			'src/test/control.test.tsx'
		);
		expect(found).toContain('testing-library/await-async-queries');
		expect(found).toContain('testing-library/await-async-utils');
	});
	it('rejects an unawaited interaction in an ordinary story play', async () => {
		const found = await rules(
			`import { userEvent, within } from 'storybook/test';
			export default { title: 'Control' };
			export const Broken = { play: async ({ canvasElement }) => {
				userEvent.click(within(canvasElement).getByRole('button'));
			} };`,
			'src/test/control.stories.tsx'
		);
		expect(found).toContain('testing-library/await-async-events');
	});
	it('accepts correctly awaited async test helpers and story interactions', async () => {
		const testRules = await rules(
			`import { screen, waitFor } from '@testing-library/react';
			async function complete() { await screen.findByRole('button'); await waitFor(() => {}); }
			void complete;`,
			'src/test/control.test.tsx'
		);
		expect(testRules).not.toContain('testing-library/await-async-queries');
		expect(testRules).not.toContain('testing-library/await-async-utils');
		const storyRules = await rules(
			`import { userEvent, within } from 'storybook/test';
			export default { title: 'Control' };
			export const Good = { play: async ({ canvasElement }) => {
				await userEvent.click(within(canvasElement).getByRole('button'));
			} };`,
			'src/test/control.stories.tsx'
		);
		expect(storyRules).not.toContain('storybook/await-interactions');
		expect(storyRules).not.toContain('testing-library/await-async-events');
	});
	it('runs native Storybook export validation independently of the modern interaction supplement', async () => {
		const found = await rules(
			'export const MissingMeta = { render: () => null };',
			'src/test/control.stories.tsx'
		);
		expect(found).toContain('storybook/default-exports');
	});
});
