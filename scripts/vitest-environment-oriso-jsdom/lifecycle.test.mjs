import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VirtualConsole } from 'jsdom';
import environment from './index.mjs';

test('initial HTML exceptions survive setup and fail teardown without removing caller listeners', async () => {
	const target = {};
	const virtualConsole = new VirtualConsole();
	const observed = [];
	const caller = (error) => observed.push(error);
	virtualConsole.on('jsdomError', caller);
	const delegated = await environment.setup(target, {
		'oriso-jsdom': {
			virtualConsole,
			html: '<script>throw new Error("initial HTML failed")</script>',
			url: 'https://environment.test/constructor'
		}
	});
	assert.equal(observed.length, 1);
	assert.equal(target.jsdom.virtualConsole, virtualConsole);
	await assert.rejects(delegated.teardown(target), (error) => {
		assert.equal(error.name, 'AggregateError');
		assert.deepEqual(error.errors, observed);
		assert.equal(error.errors[0].detail.message, 'initial HTML failed');
		return true;
	});
	assert.equal(target.jsdom, undefined);
	assert.deepEqual(virtualConsole.listeners('jsdomError'), [caller]);
});

test('healthy configured HTML preserves caller console output and options', async () => {
	const target = {};
	const virtualConsole = new VirtualConsole();
	const output = [];
	const caller = (value) => output.push(value);
	virtualConsole.on('log', caller);
	const custom = Object.freeze({
		virtualConsole,
		html: '<div id="marker"></div><script>document.getElementById("marker").textContent = "ran";console.log("caller output")</script>',
		url: 'https://environment.test/healthy'
	});
	const options = Object.freeze({ 'oriso-jsdom': custom });
	const delegated = await environment.setup(target, options);
	assert.equal(target.document.getElementById('marker').textContent, 'ran');
	assert.equal(target.location.href, custom.url);
	assert.deepEqual(output, ['caller output']);
	assert.equal(target.jsdom.virtualConsole, virtualConsole);
	await delegated.teardown(target);
	assert.deepEqual(virtualConsole.listeners('log'), [caller]);
	assert.deepEqual(virtualConsole.listeners('jsdomError'), []);
	assert.equal(options['oriso-jsdom'], custom);
});

test('failed construction removes only the owned listener from a caller console', async () => {
	const target = {};
	const virtualConsole = new VirtualConsole();
	const caller = () => {};
	virtualConsole.on('jsdomError', caller);
	await assert.rejects(
		environment.setup(target, {
			'oriso-jsdom': { virtualConsole, url: 'invalid URL' }
		}),
		TypeError
	);
	assert.deepEqual(virtualConsole.listeners('jsdomError'), [caller]);
	assert.equal(target.jsdom, undefined);
});

test('invalid options remain visible failures', async () => {
	await assert.rejects(
		environment.setup({}, { 'oriso-jsdom': null }),
		TypeError
	);
	await assert.rejects(
		environment.setup({}, { 'oriso-jsdom': { virtualConsole: {} } }),
		TypeError
	);
});
