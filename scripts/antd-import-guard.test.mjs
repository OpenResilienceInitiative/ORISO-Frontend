import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

// ORISO-Admin#1171: the Frontend has no Ant Design and must not start using it.
// CI does not run ESLint, so this test is the gate; the ESLint rule shows the
// same message in the editor.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANTD_IMPORT =
	/(?:^|\n)\s*import\s[^;]*?['"](?:antd(?:\/[^'"]*)?|@ant-design\/[^'"]+)['"]|require\(\s*['"](?:antd|@ant-design)/;

const sourceFiles = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(dir, entry.name);
		if (entry.isDirectory()) return sourceFiles(file);
		return /\.(tsx?|jsx?)$/.test(entry.name) ? [file] : [];
	});

test('no Frontend source file imports AntD', () => {
	const offenders = sourceFiles(path.join(root, 'src'))
		.filter((file) => ANTD_IMPORT.test(fs.readFileSync(file, 'utf8')))
		.map((file) => path.relative(root, file));
	assert.deepEqual(offenders, []);
});

test('ESLint rejects an AntD import with the replacement hint', async () => {
	const eslint = new ESLint({ cwd: root });
	const [result] = await eslint.lintText(
		"import { Button } from 'antd';\nimport { SearchOutlined } from '@ant-design/icons';\n",
		{ filePath: path.join(root, 'src', 'antdProbe.tsx') }
	);
	const restricted = result.messages.filter(
		(message) => message.ruleId === 'no-restricted-imports'
	);
	assert.equal(restricted.length, 2);
	assert.ok(restricted.every((message) => message.severity === 2));
	assert.match(restricted[0].message, /ORISO-Admin#1171/);
});
