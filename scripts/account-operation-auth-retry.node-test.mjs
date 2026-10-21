import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { AccountOperationIntent } from '../src/utils/accountOperationIntent.ts';

const stubs = {
	'../components/sessionCookie/accessSessionCookie': `export const getValueFromCookie=()=>'stale-test-token'; export const removeAllCookies=()=>{};`,
	'../utils/generateCsrfToken': `export const generateCsrfToken=()=>'csrf-test';`,
	'../components/error/errorHandling': `export const getErrorCaseForStatus=()=>{throw new Error('unexpected redirect')}; export const redirectToErrorPage=()=>{throw new Error('unexpected redirect')};`,
	'../components/auth/auth': `export const isPublicAuthRoute=()=>true;`,
	'../components/logout/logout': `export const logout=()=>{throw new Error('unexpected logout')};`,
	'../components/sessionCookie/accessSessionLocalStorage': `export const removeTokenExpiryFromLocalStorage=()=>{};`,
	'../utils/appConfig': `export const appConfig={urls:{toLogin:'/login'}};`,
	'../utils/requestCollector': `export class RequestLog { finish() {} }`,
	'./counsellingDpaFailure': `export const getCounsellingDpaFailure=()=>undefined;`
};
const fixtureHooks = {
	resolve(specifier, context, nextResolve) {
		if (
			context.parentURL?.endsWith('/src/api/fetchData.ts') &&
			stubs[specifier]
		)
			return {
				url: `account-auth:${encodeURIComponent(specifier)}`,
				shortCircuit: true
			};
		return nextResolve(specifier, context);
	},
	load(url, context, nextLoad) {
		if (url.startsWith('account-auth:'))
			return {
				format: 'module',
				source: stubs[
					decodeURIComponent(url.slice('account-auth:'.length))
				],
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
			`const stubs = ${JSON.stringify(stubs)};`,
			`const hooks = {${fixtureHooks.resolve.toString()},${fixtureHooks.load.toString()}};`,
			'export const resolve = hooks.resolve; export const load = hooks.load;'
		].join('\n')
	)}`,
	import.meta.url
);

test('actual public-auth recovery retains account ID and exact body on its anonymous retry', async () => {
	const { fetchData, FETCH_ERRORS } = await import('../src/api/fetchData.ts');
	const url = 'https://unit.oriso.invalid/users/email';
	const body = JSON.stringify('a@example.test');
	const intent = new AccountOperationIntent();
	const requests = [];
	const previousFetch = globalThis.fetch;
	globalThis.fetch = async (request) => {
		requests.push({
			headers: Object.fromEntries(request.headers),
			body: await request.text()
		});
		return new Response(null, {
			status: requests.length === 1 ? 401 : 204
		});
	};
	try {
		await fetchData({
			url,
			method: 'PUT',
			bodyData: body,
			timeout: 1,
			responseHandling: [FETCH_ERRORS.BAD_REQUEST],
			headersData: intent.headersFor('PUT', url, body)
		});
		assert.equal(requests.length, 2);
		assert.equal(requests[0].headers['idempotency-key'], intent.id);
		assert.equal(requests[1].headers['idempotency-key'], intent.id);
		assert.equal(requests[0].body, requests[1].body);
		assert.equal(
			requests[0].headers.authorization,
			'Bearer stale-test-token'
		);
		assert.equal(requests[1].headers.authorization, undefined);
	} finally {
		globalThis.fetch = previousFetch;
	}
});

test('actual HTTP refusal keeps the existing Error message and carries response status', async () => {
	const { fetchData, FETCH_ERRORS } = await import('../src/api/fetchData.ts');
	const previousFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response(null, { status: 400 });
	try {
		await assert.rejects(
			fetchData({
				url: 'https://unit.oriso.invalid/users/password/change',
				method: 'PUT',
				bodyData: '{}',
				timeout: 1,
				responseHandling: [FETCH_ERRORS.BAD_REQUEST]
			}),
			(error) => {
				assert.equal(error.message, FETCH_ERRORS.BAD_REQUEST);
				assert.equal(error.status, 400);
				return true;
			}
		);
	} finally {
		globalThis.fetch = previousFetch;
	}
});
