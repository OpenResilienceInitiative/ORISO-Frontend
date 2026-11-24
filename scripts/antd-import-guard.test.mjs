import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import ts from 'typescript';

// The required Storybook job runs this guard. ESLint gives editor feedback on static imports.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const replacement =
	'Use the documented ORISO component and its import from Storybook (ORISO-Admin#1171).';
const manifests = [
	'package.json',
	'proxy/package.json',
	'scripts/vitest-environment-oriso-jsdom/package.json',
	'src/extensions/package.json'
];

const isAntDesign = (name) =>
	name === 'antd' ||
	name.startsWith('antd/') ||
	name.startsWith('@ant-design/');

const sourceFiles = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(dir, entry.name);
		if (entry.isDirectory()) return sourceFiles(file);
		return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) ? [file] : [];
	});

function moduleSpecifier(node) {
	if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
		return node.moduleSpecifier;
	if (ts.isExternalModuleReference(node)) return node.expression;
	if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
		return node.argument.literal;
	if (!ts.isCallExpression(node)) return;

	const callee = node.expression;
	if (
		callee.kind === ts.SyntaxKind.ImportKeyword ||
		(ts.isIdentifier(callee) && callee.text === 'require')
	) {
		return node.arguments[0];
	}
	if (
		ts.isPropertyAccessExpression(callee) &&
		ts.isIdentifier(callee.expression)
	) {
		const name = `${callee.expression.text}.${callee.name.text}`;
		if (name === 'require.resolve' || name === 'module.require')
			return node.arguments[0];
	}
}

function antDesignReferences(filename, source) {
	const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest);
	const references = [];
	function visit(node) {
		let specifier = moduleSpecifier(node);
		while (specifier && ts.isParenthesizedExpression(specifier)) {
			specifier = specifier.expression;
		}
		if (
			specifier &&
			ts.isStringLiteralLike(specifier) &&
			isAntDesign(specifier.text)
		) {
			const location = file.getLineAndCharacterOfPosition(
				specifier.getStart(file)
			);
			references.push({ name: specifier.text, line: location.line + 1 });
		}
		ts.forEachChild(node, visit);
	}
	visit(file);
	return references;
}

function antDesignDependencies(manifest) {
	return [
		'dependencies',
		'devDependencies',
		'optionalDependencies',
		'peerDependencies'
	].flatMap((section) =>
		Object.entries(manifest[section] ?? {}).flatMap(([name, version]) => {
			const alias =
				typeof version === 'string' &&
				/^npm:((?:@[^/]+\/)?[^@]+)(?:@|$)/.exec(version)?.[1];
			if (isAntDesign(name)) return [`${section}.${name}`];
			if (alias && isAntDesign(alias))
				return [`${section}.${name} (alias for ${alias})`];
			return [];
		})
	);
}

test('recognises AntD in module references and reports their source lines', () => {
	const source = [
		"import { Slider } from /* explanation */ 'antd';",
		"import 'antd/dist/reset.css';",
		"export { Button } from 'antd';",
		'const icons = import(/* explanation */ `@ant-design/icons`);',
		"const slider = require(/* explanation */ 'antd/es/slider');",
		"const resolved = require.resolve('antd');",
		"const moduleImport = module.require('antd');",
		"import legacy = require('antd');",
		"type Props = import('antd').SliderProps;",
		"import escaped from 'a\\u006etd';",
		"void import(('antd'));",
		"const wrapped = require(('@ant-design/icons'));"
	].join('\n');
	assert.deepEqual(antDesignReferences('probe.tsx', source), [
		{ name: 'antd', line: 1 },
		{ name: 'antd/dist/reset.css', line: 2 },
		{ name: 'antd', line: 3 },
		{ name: '@ant-design/icons', line: 4 },
		{ name: 'antd/es/slider', line: 5 },
		{ name: 'antd', line: 6 },
		{ name: 'antd', line: 7 },
		{ name: 'antd', line: 8 },
		{ name: 'antd', line: 9 },
		{ name: 'antd', line: 10 },
		{ name: 'antd', line: 11 },
		{ name: '@ant-design/icons', line: 12 }
	]);
});

test('allows documentation, unrelated packages and methods on other objects', () => {
	const source = [
		"// Example of a prohibited import: import { Slider } from 'antd';",
		'const guide = "import \'antd\'";',
		"import unrelated from 'antd-example';",
		"import styled from '@mui/material';",
		"const label = help.require('antd');"
	].join('\n');
	assert.deepEqual(antDesignReferences('probe.tsx', source), []);
});

test('recognises direct AntD dependencies and npm aliases', () => {
	assert.deepEqual(
		antDesignDependencies({
			dependencies: { 'antd': '1.0.0', 'antd-example': '1.0.0' },
			devDependencies: { '@ant-design/icons': '1.0.0' },
			optionalDependencies: { styles: 'npm:antd@1.0.0' },
			peerDependencies: {
				icons: 'npm:@ant-design/icons@1.0.0',
				mui: 'npm:@mui/material@1.0.0'
			}
		}),
		[
			'dependencies.antd',
			'devDependencies.@ant-design/icons',
			'optionalDependencies.styles (alias for antd)',
			'peerDependencies.icons (alias for @ant-design/icons)'
		]
	);
});

test('no Frontend source file imports AntD', () => {
	const offenders = ['src', '.storybook'].flatMap((directory) =>
		sourceFiles(path.join(root, directory)).flatMap((file) =>
			antDesignReferences(file, fs.readFileSync(file, 'utf8')).map(
				({ name, line }) =>
					`${path.relative(root, file)}:${line} imports ${name}`
			)
		)
	);
	assert.equal(offenders.length, 0, [...offenders, replacement].join('\n'));
});

test('no Frontend package declares an AntD dependency', () => {
	const offenders = manifests.flatMap((file) =>
		antDesignDependencies(
			JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
		).map((detail) => `${file}: ${detail}`)
	);
	assert.equal(offenders.length, 0, [...offenders, replacement].join('\n'));
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
		assert.ok(onLine[0].message.includes(replacement));
	}
});
