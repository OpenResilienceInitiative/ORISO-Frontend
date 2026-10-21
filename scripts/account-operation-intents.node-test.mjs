import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import {
	AccountOperationIntent,
	AccountOperationSlot,
	AccountOperationActions
} from '../src/utils/accountOperationIntent.ts';

const requests = [];
const fetchStub = `export const FETCH_METHODS = {PUT:'PUT',PATCH:'PATCH',POST:'POST',DELETE:'DELETE'};
export const FETCH_ERRORS = {};
export const fetchData = props => globalThis.__accountIntentFetch(props);`;
globalThis.__accountIntentFetch = (request) => {
	requests.push(request);
	return Promise.resolve({});
};
const fixtureHooks = {
	resolve(specifier, context, nextResolve) {
		if (context.parentURL?.endsWith('/src/api/fetchData.ts'))
			return nextResolve(specifier, context);
		if (context.parentURL?.includes('/src/api/')) {
			if (specifier === './fetchData')
				return { url: 'account-intent:fetch', shortCircuit: true };
			if (specifier.endsWith('/endpoints'))
				return { url: 'account-intent:endpoints', shortCircuit: true };
		}
		if (specifier.startsWith('.')) {
			const candidate = new URL(`${specifier}.ts`, context.parentURL);
			if (existsSync(candidate))
				return { url: candidate.href, shortCircuit: true };
		}
		return nextResolve(specifier, context);
	},
	load(url, context, nextLoad) {
		if (url === 'account-intent:fetch')
			return { format: 'module', source: fetchStub, shortCircuit: true };
		if (url === 'account-intent:endpoints')
			return {
				format: 'module',
				source: `export const endpoints = {email:'/users/email',userData:'/users/data',passwordReset:'/users/password/change',twoFactorAuth:'/users/2fa',twoFactorAuthApp:'/users/2fa/app',twoFactorAuthEmail:'/users/2fa/email'};`,
				shortCircuit: true
			};
		return nextLoad(url, context);
	}
};
// Node 22's async loader runs fixture resolution separately; emitted modules
// still execute in the test process and use its isolated transport stubs.
register(
	`data:text/javascript,${encodeURIComponent(
		[
			"import { existsSync } from 'node:fs';",
			`const fetchStub = ${JSON.stringify(fetchStub)};`,
			`const hooks = {${fixtureHooks.resolve.toString()},${fixtureHooks.load.toString()}};`,
			'export const resolve = hooks.resolve; export const load = hooks.load;'
		].join('\n')
	)}`,
	import.meta.url
);

test('an unknown exact retry keeps its ID and captured payload', () => {
	const slot = new AccountOperationSlot();
	const input = { displayName: 'First' };
	const first = slot.prepare('profile', '/users/data', input);
	input.displayName = 'Changed in the form';
	assert.equal(first.payload.displayName, 'First');
	const retry = slot.prepare('profile', '/users/data', {
		displayName: 'First'
	});
	assert.equal(retry.intent.id, first.intent.id);
});

test('an edit back to an earlier value is a new action, even before late acknowledgement', () => {
	const slot = new AccountOperationSlot();
	const first = slot.prepare('locale', '/users/data', {
		preferredLanguage: 'de'
	});
	const second = slot.prepare('locale', '/users/data', {
		preferredLanguage: 'fr'
	});
	const third = slot.prepare('locale', '/users/data', {
		preferredLanguage: 'de'
	});
	assert.equal(
		new Set([first.intent.id, second.intent.id, third.intent.id]).size,
		3
	);
	slot.acknowledge(first.intent);
	assert.equal(
		slot.prepare('locale', '/users/data', third.payload).intent.id,
		third.intent.id
	);
});

test('acknowledged resend gets a fresh ID, unknown resend retry retains it', () => {
	const slot = new AccountOperationSlot();
	const first = slot.prepare('email-send', '/users/2fa/email', {
		email: 'a@example.test'
	});
	assert.equal(
		slot.prepare('email-send', '/users/2fa/email', first.payload).intent.id,
		first.intent.id
	);
	slot.acknowledge(first.intent);
	assert.notEqual(
		slot.prepare('email-send', '/users/2fa/email', first.payload).intent.id,
		first.intent.id
	);
});

test('the same ID refuses a changed body, target or method locally', () => {
	const intent = new AccountOperationIntent();
	intent.headersFor('PATCH', '/users/data', '{"displayName":"First"}');
	for (const args of [
		['PATCH', '/users/data', '{"displayName":"Second"}'],
		['PATCH', '/other-account', '{"displayName":"First"}'],
		['DELETE', '/users/data', '{"displayName":"First"}']
	])
		assert.throws(
			() => intent.headersFor(...args),
			/different account operation/
		);
});

test('invalid or noncanonical IDs are rejected', () => {
	for (const id of ['not-a-uuid', 'DBFD20C0-F6F8-4D23-8B9F-0841431C2C4D', ''])
		assert.throws(() => new AccountOperationIntent(id), /canonical UUID/);
});

test('actual email wrapper carries one intent through an exact retry; legacy remains optional', async () => {
	const { apiPutEmail } = await import('../src/api/apiPutEmail.ts');
	const slot = new AccountOperationSlot();
	const action = slot.prepare('email', '/users/email', 'a@example.test');
	await apiPutEmail(action.payload, action.intent);
	await apiPutEmail(action.payload, action.intent);
	const [first, retry] = requests.slice(-2);
	assert.equal(first.headersData?.['Idempotency-Key'], action.intent.id);
	assert.deepEqual(retry, first);
	await apiPutEmail('legacy@example.test');
	assert.equal(requests.at(-1).headersData?.['Idempotency-Key'], undefined);
});

test('actual action and email wire retain unknown ID and start a new acknowledged send', async () => {
	const { apiPutEmail } = await import('../src/api/apiPutEmail.ts');
	const actions = new AccountOperationActions();
	let fail = true;
	const previousFetch = globalThis.__accountIntentFetch;
	globalThis.__accountIntentFetch = (request) => {
		requests.push(request);
		return fail
			? Promise.reject(new TypeError('reply lost'))
			: Promise.resolve({});
	};
	try {
		await assert.rejects(
			actions.run('email', '/users/email', 'a@example.test', apiPutEmail)
		);
		const first = requests.at(-1);
		fail = false;
		await actions.run(
			'email',
			'/users/email',
			'a@example.test',
			apiPutEmail
		);
		assert.deepEqual(requests.at(-1), first);
		await actions.run(
			'email',
			'/users/email',
			'a@example.test',
			apiPutEmail
		);
		assert.notEqual(
			requests.at(-1).headersData['Idempotency-Key'],
			first.headersData['Idempotency-Key']
		);
	} finally {
		globalThis.__accountIntentFetch = previousFetch;
	}
});

test('password recovery callback uses the same captured intent on unknown retry', async () => {
	const actions = new AccountOperationActions();
	const observed = [];
	const submit = (payload, intent) => {
		const recoveryCallback = () => {
			observed.push([payload, intent.id]);
			return observed.length === 1
				? Promise.reject(new TypeError('unknown'))
				: Promise.resolve();
		};
		return recoveryCallback();
	};
	const payload = { oldPassword: 'old-test', newPassword: 'new-test' };
	await assert.rejects(
		actions.run('password', '/users/password/change', payload, submit)
	);
	await actions.run('password', '/users/password/change', payload, submit);
	assert.deepEqual(observed[0], observed[1]);
});

test('derived native profile payload is materialized once, before background data can change', () => {
	const actions = new AccountOperationActions();
	let username = 'captured-first';
	const materialize = (payload) => ({ ...payload, username });
	const first = actions.prepare(
		'admin-edit',
		'/useradmin/tenantadmins/id',
		{ email: 'a@example.test' },
		materialize
	);
	assert.equal(first.payload.username, 'captured-first');
	username = 'background-changed';
	const retry = actions.prepare(
		'admin-edit',
		'/useradmin/tenantadmins/id',
		{ email: 'a@example.test' },
		materialize
	);
	assert.equal(retry.intent.id, first.intent.id);
	assert.deepEqual(retry.payload, first.payload);
});

test('editing away and back before submitting starts a new action without changing the old retry', () => {
	const actions = new AccountOperationActions();
	const first = actions.prepare('locale', '/users/data', {
		preferredLanguage: 'de'
	});
	const firstHeaders = first.intent.headersFor(
		'PATCH',
		'/users/data',
		JSON.stringify(first.payload)
	);
	actions.edited('locale', '/users/data');
	actions.edited('locale', '/users/data');
	const next = actions.prepare('locale', '/users/data', {
		preferredLanguage: 'de'
	});
	assert.notEqual(next.intent.id, first.intent.id);
	assert.deepEqual(
		first.intent.headersFor(
			'PATCH',
			'/users/data',
			JSON.stringify(first.payload)
		),
		firstHeaders
	);
});

for (const [file, name, args, method] of [
	['apiPatchUserData', 'apiPatchUserData', [{ displayName: 'A' }], 'PATCH'],
	[
		'apiPatchConsultantData',
		'apiPatchConsultantData',
		[{ displayName: 'A' }],
		'PATCH'
	],
	['apiDeleteEmail', 'apiDeleteEmail', [], 'DELETE'],
	['apiUpdatePassword', 'apiUpdatePassword', ['old-test', 'new-test'], 'PUT'],
	[
		'apiTwoFactorAuth',
		'apiPutTwoFactorAuthApp',
		[{ secret: 'test-secret', otp: '123456' }],
		'PUT'
	],
	['apiTwoFactorAuth', 'apiPutTwoFactorAuthEmail', ['a@example.test'], 'PUT'],
	[
		'apiTwoFactorAuth',
		'apiPostTwoFactorAuthEmailWithCode',
		['123456'],
		'POST'
	],
	['apiTwoFactorAuth', 'apiDeleteTwoFactorAuth', [], 'DELETE']
]) {
	test(`actual ${name} wire uses its supplied intent for both dispatches`, async () => {
		const api = (await import(`../src/api/${file}.ts`))[name];
		const intent = new AccountOperationIntent();
		await api(...args, intent);
		await api(...args, intent);
		const [first, retry] = requests.slice(-2);
		assert.equal(first.headersData?.['Idempotency-Key'], intent.id);
		assert.equal(first.method, method);
		assert.deepEqual(retry, first);
	});
}

test('confirmed terminal refusal ends only its own action; a new submission gets a new ID', async () => {
	const actions = new AccountOperationActions();
	const seen = [];
	const send = (payload, intent) => {
		seen.push(intent.id);
		return seen.length === 1
			? Promise.reject(
					Object.assign(new Error('BAD_REQUEST'), { status: 400 })
				)
			: Promise.resolve();
	};
	await assert.rejects(
		actions.run('otp', '/users/2fa/app', { otp: '123456' }, send)
	);
	await actions.run('otp', '/users/2fa/app', { otp: '123456' }, send);
	assert.notEqual(seen[0], seen[1]);
});

for (const error of [
	new Error('BAD_REQUEST'),
	Object.assign(new Error('CONFLICT'), { status: 409 }),
	Object.assign(new Error('TOO_MANY_REQUESTS'), { status: 429 })
]) {
	test(`ambiguous ${error.message}/${error.status ?? 'no status'} keeps its exact intent`, async () => {
		const actions = new AccountOperationActions();
		const seen = [];
		const send = (payload, intent) => {
			seen.push(intent.id);
			return seen.length === 1
				? Promise.reject(error)
				: Promise.resolve();
		};
		await assert.rejects(
			actions.run('otp', '/users/2fa/app', { otp: '123456' }, send)
		);
		await actions.run('otp', '/users/2fa/app', { otp: '123456' }, send);
		assert.equal(seen[0], seen[1]);
	});
}
