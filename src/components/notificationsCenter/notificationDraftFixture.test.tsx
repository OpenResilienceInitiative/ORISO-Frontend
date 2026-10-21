// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import type { IUserDraftItem } from '../../api/apiUserDrafts';
import {
	beginStoryVerification,
	finishStoryVerification,
	recordUnexpectedRequest
} from '../../../.storybook/verification';

const URL =
	'https://api.storybook.test/service/users/drafts?page=0&perPage=200';
const A: IUserDraftItem = {
	scopeKey: 'scope:A',
	text: 'Opaque A',
	sourceSessionId: 103
};
const B: IUserDraftItem = {
	scopeKey: 'scope:B',
	text: 'Opaque B',
	sourceSessionId: 104
};
type Context = { parameters: { serverDrafts: IUserDraftItem[] } };
type Dispose = () => void;
type Metadata = {
	beforeEach?: (context: Context) => Dispose | void | Promise<Dispose | void>;
	decorators: Array<
		(Story: React.ComponentType, context: Context) => React.ReactElement
	>;
};

let metadata: Metadata;
let getMatrixService: typeof import('../../services/matrixClientRegistry').getMatrixClientService;
let structuredSetup: ((context: Context) => Dispose) | undefined;
let originalFetch: typeof fetch;
let delegate: ReturnType<typeof vi.fn<typeof fetch>>;

// Exercise the actual story setup/decorators both before and after the repair.
// The child starts its real fetch in a layout effect, before a parent passive effect.
const mountScenario = async (drafts: IUserDraftItem[]) => {
	const context = { parameters: { serverDrafts: drafts } };
	const disposeHook = await metadata.beforeEach?.(context);
	let response: Promise<Response> | undefined;
	const Child = () => {
		React.useLayoutEffect(() => {
			response = globalThis.fetch(URL);
		}, []);
		return null;
	};
	const Wrapped = metadata.decorators.reduceRight<React.ComponentType>(
		(Story, decorate) => () => decorate(Story, context),
		Child
	);
	const view = render(<Wrapped />);
	expect(response).toBeDefined();
	return {
		response: response!,
		dispose: () => {
			view.unmount();
			if (typeof disposeHook === 'function') disposeHook();
		}
	};
};

beforeEach(async () => {
	originalFetch = globalThis.fetch;
	delegate = vi.fn(async (input, init) =>
		recordUnexpectedRequest(new Request(input, init))
	);
	globalThis.fetch = delegate;
	vi.resetModules();
	const stories = await import('./NotificationsCenter.stories');
	metadata = stories.default as unknown as Metadata;
	structuredSetup = stories.StructuredFirstResponse
		.beforeEach as unknown as typeof structuredSetup;
	({ getMatrixClientService: getMatrixService } = await import(
		'../../services/matrixClientRegistry'
	));
});
afterEach(async () => {
	cleanup();
	try {
		await finishStoryVerification();
	} finally {
		globalThis.fetch = originalFetch;
	}
});

describe('NotificationsCenter run-owned draft fixture', () => {
	it('installs before a child read and survives actual verification completion in A → empty B → A order', async () => {
		for (const items of [[A], [], [A]]) {
			const finish = beginStoryVerification();
			const scenario = await mountScenario(items);
			await expect((await scenario.response).json()).resolves.toEqual({
				items,
				page: 0,
				perPage: 200
			});
			await finish.complete();
			scenario.dispose();
			expect(globalThis.fetch).toBe(delegate);
		}
		expect(delegate).not.toHaveBeenCalled();
	});

	it('captures the scenario payload rather than reading later mutable parameters', async () => {
		const items = [{ ...A }];
		const finish = beginStoryVerification();
		const scenario = await mountScenario(items);
		await scenario.response;
		items[0].text = 'Changed after installation';
		items.push(B);
		await expect((await fetch(URL)).json()).resolves.toEqual({
			items: [A],
			page: 0,
			perPage: 200
		});
		scenario.dispose();
		await finish.complete();
	});

	it('restores its exact captured fetch on disposal and is idempotent', async () => {
		const scenario = await mountScenario([A]);
		await scenario.response;
		scenario.dispose();
		expect(globalThis.fetch).toBe(delegate);
		scenario.dispose();
		expect(globalThis.fetch).toBe(delegate);
	});

	it('late repeated A disposal cannot clear B data or overwrite its owned fetch', async () => {
		const first = beginStoryVerification();
		const a = await mountScenario([A]);
		await a.response;
		await first.complete();
		const second = beginStoryVerification();
		const b = await mountScenario([B]);
		await b.response;
		const ownedByB = globalThis.fetch;
		a.dispose();
		a.dispose();
		expect(globalThis.fetch).toBe(ownedByB);
		await expect((await fetch(URL)).json()).resolves.toEqual({
			items: [B],
			page: 0,
			perPage: 200
		});
		b.dispose();
		await second.complete();
	});

	it('does not replace a foreign wrapper installed after its own', async () => {
		const scenario = await mountScenario([A]);
		await scenario.response;
		const foreign = vi.fn<typeof fetch>();
		globalThis.fetch = foreign;
		scenario.dispose();
		scenario.dispose();
		expect(globalThis.fetch).toBe(foreign);
	});

	it('deactivates a held A wrapper so it cannot answer B requests after A disposal', async () => {
		const finish = beginStoryVerification();
		const a = await mountScenario([A]);
		await a.response;
		const heldA = globalThis.fetch;
		a.dispose();
		const b = await mountScenario([B]);
		await b.response;
		await expect(heldA(URL)).rejects.toThrow(
			`Unexpected product API request: GET ${URL}`
		);
		await expect(finish.complete()).rejects.toThrow(
			`unexpected-request: GET ${URL}`
		);
		b.dispose();
	});

	it('releases ownership even when actual awaited completion fails', async () => {
		const failure = new Error('owned cleanup failed');
		const finish = beginStoryVerification([], {
			cleanup: async () => {
				throw failure;
			}
		});
		const scenario = await mountScenario([A]);
		await scenario.response;
		await expect(finish.complete()).rejects.toThrow('owned cleanup failed');
		expect(globalThis.fetch).toBe(delegate);
		scenario.dispose();
		scenario.dispose();
		expect(globalThis.fetch).toBe(delegate);
	});

	it('composes the existing structured-response Matrix setup and its original restore', async () => {
		const finish = beginStoryVerification();
		const originalMatrix = getMatrixService();
		const scenario = await mountScenario([A]);
		await scenario.response;
		expect(structuredSetup).toBeTypeOf('function');
		const restoreMatrix = structuredSetup!({
			parameters: { serverDrafts: [A] }
		});
		// The story uses the actual MatrixEvent hydrator; native play verifies its text/search.
		expect(getMatrixService()).not.toBe(originalMatrix);
		restoreMatrix();
		expect(getMatrixService()).toBe(originalMatrix);
		scenario.dispose();
		await finish.complete();
	});

	it.each(['string', 'URL', 'Request'])(
		'answers only the declared read for %s input',
		async (kind) => {
			const scenario = await mountScenario([A]);
			await scenario.response;
			const input =
				kind === 'URL'
					? new globalThis.URL(URL)
					: kind === 'Request'
						? new Request(URL)
						: URL;
			const response = await fetch(input);
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe(
				'application/json'
			);
			await expect(response.json()).resolves.toEqual({
				items: [A],
				page: 0,
				perPage: 200
			});
			expect(delegate).not.toHaveBeenCalled();
			scenario.dispose();
		}
	);

	const rejected = [
		[
			'wrong origin',
			'https://other.storybook.test/service/users/drafts?page=0&perPage=200',
			'GET'
		],
		[
			'wrong path',
			'https://api.storybook.test/service/users/drafts/extra?page=0&perPage=200',
			'GET'
		],
		[
			'single draft',
			'https://api.storybook.test/service/users/drafts/single?scopeKey=A',
			'GET'
		],
		[
			'wrong page',
			'https://api.storybook.test/service/users/drafts?page=1&perPage=200',
			'GET'
		],
		[
			'wrong page size',
			'https://api.storybook.test/service/users/drafts?page=0&perPage=10',
			'GET'
		],
		['extra query', `${URL}&other=1`, 'GET'],
		['duplicate query', `${URL}&page=0`, 'GET'],
		[
			'missing query',
			'https://api.storybook.test/service/users/drafts',
			'GET'
		],
		['write', URL, 'PATCH'],
		['delete', URL, 'DELETE'],
		['wrong method', URL, 'POST']
	];
	it.each(rejected)(
		'delegates %s unchanged to the actual strict request guard',
		async (_name, url, method) => {
			const finish = beginStoryVerification();
			const scenario = await mountScenario([A]);
			await scenario.response;
			const controller = new AbortController();
			const input = new Request(url);
			const init = { method, signal: controller.signal };
			await expect(fetch(input, init)).rejects.toThrow(
				`Unexpected product API request: ${method} ${url}`
			);
			expect(delegate).toHaveBeenCalledExactlyOnceWith(input, init);
			await expect(finish.complete()).rejects.toThrow(
				`unexpected-request: ${method} ${url}`
			);
			scenario.dispose();
		}
	);
});
