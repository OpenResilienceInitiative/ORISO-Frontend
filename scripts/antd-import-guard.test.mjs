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
// Static, side-effect, dynamic and re-export imports plus require; exact package names only.
const ANTD_IMPORT =
	/(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"](?:antd(?:\/[^'"]*)?|@ant-design\/[^'"]+)['"]/;

const sourceFiles = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(dir, entry.name);
		if (entry.isDirectory()) return sourceFiles(file);
		return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) ? [file] : [];
	});

test('the scan recognises every way of importing AntD', () => {
	for (const source of [
		"import { Button } from 'antd';",
		"const x = 1; import 'antd/dist/reset.css';",
		"export { Button } from 'antd';",
		"const icons = await import('@ant-design/icons');",
		"const antd = require('antd');"
	]) {
		assert.match(source, ANTD_IMPORT, source);
	}
	for (const source of [
		"import x from 'antd-foo';",
		"const y = require('antdesign');",
		"import { Button } from '@mui/material';"
	]) {
		assert.doesNotMatch(source, ANTD_IMPORT, source);
	}
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
	for (const line of [1, 2]) {
		const onLine = restricted.filter((message) => message.line === line);
		assert.equal(onLine.length, 1, `one AntD error on line ${line}`);
		assert.equal(onLine[0].severity, 2);
		assert.match(onLine[0].message, /ORISO-Admin#1171/);
	}
});
