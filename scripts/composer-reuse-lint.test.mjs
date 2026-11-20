import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ESLint } from 'eslint';

const eslint = new ESLint();
const lint = async (filePath, source) =>
	(await eslint.lintText(source, { filePath }))[0].messages;

describe('shared composer lint contract', () => {
	for (const directory of [
		'enquiry',
		'notificationsCenter',
		'session',
		'chatStage'
	]) {
		it(`rejects a second editor implementation in ${directory}`, async () => {
			const messages = await lint(
				`src/components/${directory}/LintControl.tsx`,
				`import { useEditor } from '@tiptap/react';
export const View = () => <div contentEditable={Boolean(useEditor())} />;`
			);
			assert.deepEqual(
				messages.map(({ ruleId }) => ruleId),
				['no-restricted-imports', 'no-restricted-syntax']
			);
		});
	}

	it('rejects direct imports of the internal editor through relative and aliased paths', async () => {
		for (const path of [
			'../messageSubmitInterface/TipTapComposer',
			'@/components/messageSubmitInterface/TipTapComposer.tsx'
		]) {
			const messages = await lint(
				'src/components/session/LintControl.tsx',
				`export { TipTapComposer } from '${path}';`
			);
			assert.deepEqual(
				messages.map(({ ruleId }) => ruleId),
				['no-restricted-imports']
			);
		}
	});

	it('rejects lazy imports of a separate editor', async () => {
		for (const path of [
			'@tiptap/react/menus',
			'../messageSubmitInterface/TipTapComposer'
		]) {
			const messages = await lint(
				'src/components/session/LintControl.tsx',
				`export const prepareEditor = () => import('${path}');`
			);
			assert.deepEqual(
				messages.map(({ ruleId }) => ruleId),
				['no-restricted-syntax']
			);
		}
	});

	it('permits two instances of the shared composer', async () => {
		assert.deepEqual(
			await lint(
				'src/components/session/LintControl.tsx',
				`import { MessageSubmitInterfaceComponent as Composer } from '../messageSubmitInterface/messageSubmitInterfaceComponent';
export const View = () => <><Composer /><Composer /></>;`
			),
			[]
		);
	});

	it('leaves editor fixtures and the implementation itself available', async () => {
		for (const path of [
			'src/components/messageSubmitInterface/LintControl.tsx',
			'src/components/session/LintControl.test.tsx',
			'src/components/session/LintControl.stories.tsx',
			'src/components/session/__storybook__/LintControl.tsx'
		]) {
			assert.deepEqual(
				await lint(
					path,
					`import { useEditor } from '@tiptap/react';
const meta = { title: 'Control' };
export default meta;
export const View = () => <div contentEditable={Boolean(useEditor())} />;`
				),
				[]
			);
		}
	});
});
