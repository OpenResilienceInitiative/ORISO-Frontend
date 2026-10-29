import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

/**
 * A key written twice in one object is valid JSON, and the last one wins.
 * A merge left "calls" twice in de@informal, so the second block hid the
 * first and the informal call share texts fell back to raw keys.
 */

const root = 'src/resources/i18n';

const bundles = readdirSync(root, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.flatMap((dir) =>
		readdirSync(join(root, dir.name))
			.filter((file) => file.endsWith('.json'))
			.map((file) => join(root, dir.name, file))
	);

/** Every "path.key" that appears twice inside the same object. */
const duplicateKeys = (text: string): string[] => {
	const found: string[] = [];
	// One frame per open object or array; arrays hold no keys.
	const stack: { keys: Set<string>; path: string; isObject: boolean }[] = [];
	let lastString = '';
	let pendingKey = '';
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === '"') {
			let end = i + 1;
			while (text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
			lastString = text.slice(i + 1, end);
			i = end;
		} else if (ch === ':') {
			const frame = stack[stack.length - 1];
			const path = frame.path
				? `${frame.path}.${lastString}`
				: lastString;
			if (frame.keys.has(lastString)) found.push(path);
			frame.keys.add(lastString);
			pendingKey = path;
		} else if (ch === '{' || ch === '[') {
			const parent = stack[stack.length - 1];
			stack.push({
				keys: new Set(),
				path: parent?.isObject ? pendingKey : (parent?.path ?? ''),
				isObject: ch === '{'
			});
		} else if (ch === '}' || ch === ']') {
			stack.pop();
		}
	}
	return found;
};

describe('translation bundles', () => {
	it('finds the bundles', () => {
		expect(bundles.length).toBeGreaterThan(6);
	});

	it.each(bundles)('%s has no key written twice', (file) => {
		expect(duplicateKeys(readFileSync(file, 'utf8'))).toEqual([]);
	});

	it('catches a key written twice', () => {
		expect(duplicateKeys('{"a":{"b":1},"a":{"c":2}}')).toEqual(['a']);
		expect(duplicateKeys('{"a":{"b":1,"b":2},"c":["x"]}')).toEqual(['a.b']);
	});
});
