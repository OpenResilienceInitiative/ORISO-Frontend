import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forwardEnvironmentOptions } from './index.mjs';

test('existing builtin options retain their exact identity without an alias key', () => {
	const options = Object.freeze({
		jsdom: Object.freeze({ url: 'https://example.test/' }),
		other: false
	});
	assert.equal(forwardEnvironmentOptions(options), options);
});
test('custom docblock options reach builtin jsdom without merging or mutating caller values', () => {
	const custom = Object.freeze({
		url: 'https://alias.test/',
		pretendToBeVisual: false
	});
	const previous = Object.freeze({
		url: 'https://project.test/',
		html: 'project value must not merge'
	});
	const options = Object.freeze({
		'jsdom': previous,
		'oriso-jsdom': custom,
		'other': false
	});
	const forwarded = forwardEnvironmentOptions(options);
	assert.equal(forwarded.jsdom, custom);
	assert.equal(options.jsdom, previous);
	assert.equal(forwarded.other, false);
	assert.equal(forwarded['oriso-jsdom'], custom);
});
test('explicit falsy alias values pass through rather than becoming default or truthy options', () => {
	for (const value of [false, null, undefined]) {
		const options = Object.freeze({ 'oriso-jsdom': value });
		assert.equal(forwardEnvironmentOptions(options).jsdom, value);
	}
});
