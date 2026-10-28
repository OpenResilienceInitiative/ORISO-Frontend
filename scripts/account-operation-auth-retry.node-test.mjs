import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';

const stubs = {
	'../components/sessionCookie/accessSessionCookie': `export const getValueFromCookie=()=>globalThis.__accountAuthToken ?? 'header.eyJzdWIiOiJzYW1lLXBlcnNvbiJ9.signature'; export const removeAllCookies=()=>{};`,
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
		if (specifier.startsWith('.')) {
			const candidate = new URL(`${specifier}.ts`, context.parentURL);
			if (existsSync(candidate))
				return { url: candidate.href, shortCircuit: true };
		}
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
const { AccountOperationIntent, AccountOperationActions } = await import(
	'../src/utils/accountOperationIntent.ts'
);

test('an authenticated frozen account request cannot retry anonymously on a public page', async () => {
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
		await assert.rejects(
			fetchData({
				url,
				method: 'PUT',
				bodyData: body,
				timeout: 1,
				responseHandling: [FETCH_ERRORS.BAD_REQUEST],
				headersData: intent.headersFor('PUT', url, body)
			}),
			(error) => error.message === FETCH_ERRORS.UNAUTHORIZED
		);
		assert.equal(requests.length, 1);
		assert.equal(requests[0].headers['idempotency-key'], intent.id);
		assert.equal(
			requests[0].headers.authorization,
			'Bearer header.eyJzdWIiOiJzYW1lLXBlcnNvbiJ9.signature'
		);
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

test('an explicitly anonymous public account request keeps its frozen key without a bearer', async () => {
	const { fetchData } = await import('../src/api/fetchData.ts');
	const previousFetch = globalThis.fetch;
	const url = 'https://unit.oriso.invalid/account-invites/token/accept';
	const body = JSON.stringify({ password: 'synthetic-password' });
	const intent = new AccountOperationIntent();
	const requests = [];
	globalThis.fetch = async (request) => {
		requests.push({
			headers: Object.fromEntries(request.headers),
			body: await request.text()
		});
		return new Response(null, { status: 204 });
	};
	try {
		await fetchData({
			url,
			method: 'POST',
			bodyData: body,
			skipAuth: true,
			timeout: 1,
			headersData: intent.headersFor('POST', url, body)
		});
		assert.equal(requests.length, 1);
		assert.equal(requests[0].headers.authorization, undefined);
		assert.equal(requests[0].headers['idempotency-key'], intent.id);
		assert.equal(requests[0].body, body);
	} finally {
		globalThis.fetch = previousFetch;
	}
});

async function withObservedMutationResponse(respond, check) {
	const { fetchData, FETCH_ERRORS } = await import('../src/api/fetchData.ts');
	const previous = globalThis.fetch;
	const requests = [];
	const actions = new AccountOperationActions();
	const url =
		'https://unit.oriso.invalid/useradmin/consultants/synthetic-account';
	globalThis.fetch = async (request) => {
		requests.push(request.headers.get('Idempotency-Key'));
		return respond(request, requests.length);
	};
	const run = () =>
		actions.run('save', url, { firstName: 'Lisa' }, (payload, intent) => {
			const body = JSON.stringify(payload);
			return fetchData({
				url,
				method: 'PUT',
				bodyData: body,
				timeout: 1,
				headersData: intent.headersFor('PUT', url, body),
				responseHandling: [
					FETCH_ERRORS.BAD_REQUEST,
					FETCH_ERRORS.FORBIDDEN,
					FETCH_ERRORS.CONFLICT,
					FETCH_ERRORS.PRECONDITION_FAILED
				]
			});
		});
	try {
		await check(run, requests);
	} finally {
		globalThis.fetch = previous;
	}
}

for (const status of [400, 403, 412, 422]) {
	test(`unknown App mutation retains its original intent after an unsigned ${status}`, async () => {
		await withObservedMutationResponse(
			(request, number) => {
				if (number === 1)
					throw new TypeError('synthetic first response lost');
				return new Response(null, {
					status: number === 2 ? status : 204
				});
			},
			async (run, requests) => {
				await assert.rejects(run());
				await assert.rejects(run());
				await run();
				assert.equal(requests[2], requests[0]);
				await run();
				assert.notEqual(requests[3], requests[0]);
			}
		);
	});
}

test('matching committed NO_EFFECT response ends an unknown App attempt', async () => {
	await withObservedMutationResponse(
		(request, number) => {
			if (number === 1)
				throw new TypeError('synthetic first response lost');
			return new Response(
				null,
				number === 2
					? {
							status: 409,
							headers: {
								'X-ORISO-Mutation-Outcome': 'NO_EFFECT',
								'X-ORISO-Mutation-Operation':
									request.headers.get('Idempotency-Key')
							}
						}
					: { status: 204 }
			);
		},
		async (run, requests) => {
			await assert.rejects(run());
			await assert.rejects(run(), (error) => error.status === 409);
			await run();
			assert.notEqual(requests[2], requests[0]);
		}
	);
});

test('another operation NO_EFFECT response cannot retire an unknown App intent', async () => {
	await withObservedMutationResponse(
		(request, number) => {
			if (number === 1)
				throw new TypeError('synthetic first response lost');
			return new Response(
				null,
				number === 2
					? {
							status: 400,
							headers: {
								'X-ORISO-Mutation-Outcome': 'NO_EFFECT',
								'X-ORISO-Mutation-Operation':
									'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
							}
						}
					: { status: 204 }
			);
		},
		async (run, requests) => {
			await assert.rejects(run());
			await assert.rejects(run());
			await run();
			assert.equal(requests[2], requests[0]);
		}
	);
});

test('error properties cannot invent a committed App NO_EFFECT response', async () => {
	const actions = new AccountOperationActions();
	const attempts = [];
	const run = () =>
		actions.run(
			'save',
			'synthetic-account',
			{},
			async (payload, intent) => {
				attempts.push(intent.id);
				if (attempts.length === 1)
					throw new TypeError('synthetic first response lost');
				if (attempts.length === 2)
					throw Object.assign(new Error('synthetic forged fields'), {
						status: 400,
						mutationOutcome: 'NO_EFFECT',
						mutationOperation: intent.id
					});
			}
		);
	await assert.rejects(run());
	await assert.rejects(run());
	await run();
	assert.equal(attempts[2], attempts[0]);
});

test('a previously verified refusal cannot acknowledge a different App attempt', async () => {
	let previousReply;
	await assert.rejects(
		new AccountOperationActions().run(
			'save',
			'first-account',
			{},
			async (payload, intent) => {
				previousReply = new Response(null, {
					status: 409,
					headers: {
						'X-ORISO-Mutation-Outcome': 'NO_EFFECT',
						'X-ORISO-Mutation-Operation': intent.id
					}
				});
				throw previousReply;
			}
		)
	);
	const current = new AccountOperationActions();
	const ids = [];
	const run = () =>
		current.run('save', 'second-account', {}, async (payload, intent) => {
			ids.push(intent.id);
			if (ids.length === 1)
				throw new TypeError('synthetic current response lost');
			if (ids.length === 2) throw previousReply;
		});
	await assert.rejects(run());
	await assert.rejects(run());
	await run();
	assert.equal(ids[2], ids[0]);
});

const tokenFor = (subject, revision) =>
	`header.${Buffer.from(JSON.stringify({ sub: subject, revision })).toString('base64url')}.signature`;

for (const status of [400, 403, 412, 422]) {
	test(`a first unsigned ${status} cannot retire an account attempt`, async () => {
		await withObservedMutationResponse(
			(_request, number) =>
				new Response(null, { status: number === 1 ? status : 204 }),
			async (run, requests) => {
				await assert.rejects(run());
				await run();
				assert.equal(requests[1], requests[0]);
			}
		);
	});
}

test('separate transport invocations refuse a captured action after an account switch', async () => {
	const { fetchData } = await import('../src/api/fetchData.ts');
	const previous = globalThis.fetch;
	const intent = new AccountOperationIntent();
	const url = 'https://unit.oriso.invalid/users/data';
	let requests = 0;
	globalThis.__accountAuthToken = tokenFor('first-person', 1);
	globalThis.fetch = async () => {
		requests++;
		throw new TypeError('response lost');
	};
	const run = () =>
		fetchData({
			url,
			method: 'PATCH',
			bodyData: '{}',
			timeout: 1,
			headersData: intent.headersFor('PATCH', url, '{}')
		});
	try {
		await assert.rejects(run(), /response lost/);
		globalThis.__accountAuthToken = tokenFor('second-person', 1);
		await assert.rejects(run(), /REQUEST_IDENTITY_CHANGED/);
		assert.equal(
			requests,
			1,
			'the original action body never reaches another account'
		);
		globalThis.__accountAuthToken = tokenFor('first-person', 2);
		await assert.rejects(run(), /response lost/);
		assert.equal(
			requests,
			2,
			'same-person token renewal retains the original action'
		);
	} finally {
		globalThis.fetch = previous;
		delete globalThis.__accountAuthToken;
	}
});

test('an anonymous captured action cannot become authenticated on a later invocation', async () => {
	const { fetchData } = await import('../src/api/fetchData.ts');
	const previous = globalThis.fetch;
	const intent = new AccountOperationIntent();
	const url = 'https://unit.oriso.invalid/users/data';
	let requests = 0;
	globalThis.__accountAuthToken = tokenFor('signed-in-person', 1);
	globalThis.fetch = async () => {
		requests++;
		throw new TypeError('response lost');
	};
	const run = (skipAuth) =>
		fetchData({
			url,
			method: 'PATCH',
			bodyData: '{}',
			skipAuth,
			timeout: 1,
			headersData: intent.headersFor('PATCH', url, '{}')
		});
	try {
		await assert.rejects(run(true), /response lost/);
		await assert.rejects(run(false), /REQUEST_IDENTITY_CHANGED/);
		assert.equal(requests, 1);
	} finally {
		globalThis.fetch = previous;
		delete globalThis.__accountAuthToken;
	}
});

test('unreadable tokens are never retained as ownership or assumed to establish the same retry subject', async () => {
	const { accountOperationOwner, assertAccountOperationOwner } = await import(
		'../src/utils/accountOperationOwner.ts'
	);
	const owner = accountOperationOwner('synthetic-unreadable-credential');
	assert.equal(owner, 'unverified');
	const headers = new AccountOperationIntent().headersFor(
		'PATCH',
		'/users/data',
		'{}'
	);
	assertAccountOperationOwner(headers, owner, owner);
	assert.throws(
		() => assertAccountOperationOwner(headers, owner, owner),
		/REQUEST_IDENTITY_CHANGED/
	);
});
