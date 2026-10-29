// @vitest-environment oriso-jsdom
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
import {
	beginStoryVerification,
	finishStoryVerification,
	recordUnexpectedRequest
} from '../../../../.storybook/verification';

const endpoint = 'https://api.storybook.test/service/users/drafts/single';
const readUrl = (scope = 'scope:360|thread:main') =>
	`${endpoint}?scopeKey=${encodeURIComponent(scope)}`;
let originalFetch: typeof fetch;
let delegate: ReturnType<typeof vi.fn<typeof fetch>>;
const install = async () => {
	const fixture = await import('./composerStoryDecorator');
	return fixture.installComposerSingleDraftFixture();
};
beforeEach(() => {
	originalFetch = globalThis.fetch;
	delegate = vi.fn(async (input, init) =>
		recordUnexpectedRequest(new Request(input, init))
	);
	globalThis.fetch = delegate;
});
afterEach(async () => {
	cleanup();
	try {
		await finishStoryVerification();
	} finally {
		globalThis.fetch = originalFetch;
	}
});

describe('composer scenario-owned single draft fixture', () => {
	it.each(['string', 'URL', 'Request'])(
		'answers the exact empty GET for %s input',
		async (kind) => {
			const dispose = await install();
			const input =
				kind === 'Request'
					? new Request(readUrl())
					: kind === 'URL'
						? new URL(readUrl())
						: readUrl();
			const response = await fetch(input);
			expect(response.status).toBe(204);
			await expect(response.text()).resolves.toBe('');
			expect(delegate).not.toHaveBeenCalled();
			dispose();
		}
	);
	it('declares only the three observed empty composer scope keys', async () => {
		const dispose = await install();
		for (const scope of [
			'scope:360|thread:main',
			'scope:361|thread:main',
			'scope:9001|thread:main'
		]) {
			expect((await fetch(readUrl(scope))).status).toBe(204);
		}
		expect(delegate).not.toHaveBeenCalled();
		dispose();
	});
	it('installs before a real child layout-effect read and retains the actual 360 to 361 session switch', async () => {
		const { ComposerStoryDecorator, buildMockActiveSession } = await import(
			'./composerStoryDecorator'
		);
		const reads: Promise<Response>[] = [];
		const Child = ({ scope }: { scope: string }) => {
			React.useLayoutEffect(() => {
				reads.push(fetch(readUrl(scope)));
			}, [scope]);
			return null;
		};
		const scene = (id: number) => (
			<ComposerStoryDecorator
				activeSession={buildMockActiveSession({}, { id })}
			>
				<Child scope={`scope:${id}|thread:main`} />
			</ComposerStoryDecorator>
		);
		const view = render(scene(360));
		expect(reads).toHaveLength(1);
		expect((await reads[0]).status).toBe(204);
		view.rerender(scene(361));
		expect(reads).toHaveLength(2);
		expect((await reads[1]).status).toBe(204);
		view.unmount();
		expect(globalThis.fetch).toBe(delegate);
		expect(delegate).not.toHaveBeenCalled();

		// Match the real image story: discarded StrictMode renders, verification
		// restoration before unmount, then another composer in the same module.
		const strictPhase = beginStoryVerification();
		const strict = render(
			<div>
				<React.StrictMode>{scene(360)}</React.StrictMode>
			</div>
		);
		const strictReads = reads.slice(2);
		expect(strictReads.length).toBeGreaterThan(0);
		for (const response of await Promise.all(strictReads))
			expect(response.status).toBe(204);
		await strictPhase.complete();
		strict.unmount();
		expect(globalThis.fetch).toBe(delegate);
		const nextPhase = beginStoryVerification();
		const next = render(scene(361));
		try {
			const response = await fetch(
				'https://api.storybook.test/service/users/consultants?agencyId=101'
			);
			const { storybookAgencyConsultants } = await import(
				'./composerStoryDecorator'
			);
			await expect(response.json()).resolves.toEqual(
				storybookAgencyConsultants
			);
		} finally {
			next.unmount();
			await nextPhase.complete();
		}
	});
	it('restores its captured fetch exactly once', async () => {
		const dispose = await install();
		dispose();
		expect(globalThis.fetch).toBe(delegate);
		dispose();
		expect(globalThis.fetch).toBe(delegate);
	});
	it('late A disposal cannot replace B and a held A cannot answer after disposal', async () => {
		const finish = beginStoryVerification();
		const disposeA = await install();
		const heldA = globalThis.fetch;
		disposeA();
		const disposeB = await install();
		const heldB = globalThis.fetch;
		disposeA();
		expect(globalThis.fetch).toBe(heldB);
		expect((await fetch(readUrl('scope:361|thread:main'))).status).toBe(
			204
		);
		await expect(heldA(readUrl())).rejects.toThrow(
			'Unexpected product API request: GET'
		);
		await expect(finish.complete()).rejects.toThrow(
			'unexpected-request: GET'
		);
		disposeB();
	});
	it('does not overwrite a newer foreign fetch wrapper on disposal', async () => {
		const dispose = await install();
		const foreign = vi.fn<typeof fetch>();
		globalThis.fetch = foreign;
		dispose();
		dispose();
		expect(globalThis.fetch).toBe(foreign);
		// The actual decorator's outer composer wrapper must also respect ownership.
		globalThis.fetch = delegate;
		const { ComposerStoryDecorator } = await import(
			'./composerStoryDecorator'
		);
		const view = render(
			<ComposerStoryDecorator>
				<span />
			</ComposerStoryDecorator>
		);
		globalThis.fetch = foreign;
		view.unmount();
		expect(globalThis.fetch).toBe(foreign);
	});

	const rejected = [
		[
			'wrong origin',
			readUrl().replace('api.storybook.test', 'foreign.storybook.test'),
			'GET'
		],
		[
			'plural list path',
			'https://api.storybook.test/service/users/drafts?page=0&perPage=200',
			'GET'
		],
		['unowned scope', readUrl('scope:4711|thread:main'), 'GET'],
		['missing query', endpoint, 'GET'],
		['extra query', `${readUrl()}&other=1`, 'GET'],
		[
			'duplicate query',
			`${readUrl()}&scopeKey=scope%3A360%7Cthread%3Amain`,
			'GET'
		],
		['fragment', `${readUrl()}#other`, 'GET'],
		['write', readUrl(), 'PATCH']
	];
	it.each(rejected)(
		'delegates %s unchanged to the actual strict request guard',
		async (_name, url, method) => {
			const finish = beginStoryVerification();
			const dispose = await install();
			const input = new Request(url);
			const init = { method, signal: new AbortController().signal };
			await expect(fetch(input, init)).rejects.toThrow(
				`Unexpected product API request: ${method} ${url}`
			);
			expect(delegate).toHaveBeenCalledExactlyOnceWith(input, init);
			await expect(finish.complete()).rejects.toThrow(
				`unexpected-request: ${method} ${url}`
			);
			dispose();
		}
	);
	it('reads Request.method and permits an explicit GET override without swallowing a write', async () => {
		const finish = beginStoryVerification();
		const dispose = await install();
		const request = new Request(readUrl(), { method: 'POST' });
		await expect(fetch(request)).rejects.toThrow(
			'Unexpected product API request: POST'
		);
		expect((await fetch(request, { method: 'GET' })).status).toBe(204);
		await expect(finish.complete()).rejects.toThrow(
			'unexpected-request: POST'
		);
		dispose();
	});
});

describe('Native DPA explicitly empty draft index', () => {
	const indexScope = 'scope:__draft-index__|thread:main';
	const indexUrl = () => readUrl(indexScope);
	it('installs the declared Native DPA empty index before child layout reads without changing group draft absence', async () => {
		const { ComposerStoryDecorator, buildMockGroupSession } = await import(
			'./composerStoryDecorator'
		);
		const reads: Promise<Response>[] = [];
		const Child = () => {
			React.useLayoutEffect(() => {
				reads.push(fetch(new Request(indexUrl())));
				reads.push(fetch(readUrl('scope:9001|thread:main')));
			}, []);
			return null;
		};
		const view = render(
			<ComposerStoryDecorator
				activeSession={buildMockGroupSession()}
				emptyDraftIndex
			>
				<Child />
			</ComposerStoryDecorator>
		);
		expect(reads).toHaveLength(2);
		for (const response of await Promise.all(reads)) {
			expect(response.status).toBe(204);
			await expect(response.text()).resolves.toBe('');
		}
		view.unmount();
		expect(globalThis.fetch).toBe(delegate);
		expect(delegate).not.toHaveBeenCalled();
	});
	it('keeps the index opt-in scoped to its lifetime across Native A, ordinary B and Native A again', async () => {
		const fixture = await import('./composerStoryDecorator');
		const disposeA = fixture.installComposerSingleDraftFixture({
			emptyDraftIndex: true
		});
		const heldA = globalThis.fetch;
		expect((await fetch(indexUrl())).status).toBe(204);
		disposeA();
		const finish = beginStoryVerification();
		const disposeB = fixture.installComposerSingleDraftFixture();
		const heldB = globalThis.fetch;
		disposeA();
		expect(globalThis.fetch).toBe(heldB);
		await expect(fetch(indexUrl())).rejects.toThrow(
			'Unexpected product API request: GET'
		);
		await expect(heldA(indexUrl())).rejects.toThrow(
			'Unexpected product API request: GET'
		);
		await expect(finish.complete()).rejects.toThrow(
			'unexpected-request: GET'
		);
		disposeB();
		const disposeAgain = fixture.installComposerSingleDraftFixture({
			emptyDraftIndex: true
		});
		expect((await fetch(indexUrl())).status).toBe(204);
		disposeAgain();
		expect(globalThis.fetch).toBe(delegate);
	});
	const rejectedIndexReads = [
		[
			'wrong origin',
			readUrl(indexScope).replace(
				'api.storybook.test',
				'foreign.storybook.test'
			),
			'GET'
		],
		[
			'plural path',
			`https://api.storybook.test/service/users/drafts?scopeKey=${encodeURIComponent(indexScope)}`,
			'GET'
		],
		['unowned stage scope', readUrl('scope:4711|thread:main'), 'GET'],
		['missing query', endpoint, 'GET'],
		['extra query', `${readUrl(indexScope)}&other=1`, 'GET'],
		[
			'duplicate query',
			`${readUrl(indexScope)}&scopeKey=${encodeURIComponent(indexScope)}`,
			'GET'
		],
		['fragment', `${readUrl(indexScope)}#other`, 'GET'],
		['write', readUrl(indexScope), 'POST']
	];
	it.each(rejectedIndexReads)(
		'delegates %s even when the empty index is declared',
		async (_name, url, method) => {
			const fixture = await import('./composerStoryDecorator');
			const finish = beginStoryVerification();
			const dispose = fixture.installComposerSingleDraftFixture({
				emptyDraftIndex: true
			});
			const input = new Request(url, { method });
			const init = { signal: new AbortController().signal };
			await expect(fetch(input, init)).rejects.toThrow(
				`Unexpected product API request: ${method} ${url}`
			);
			expect(delegate).toHaveBeenCalledExactlyOnceWith(input, init);
			await expect(finish.complete()).rejects.toThrow(
				`unexpected-request: ${method} ${url}`
			);
			dispose();
		}
	);
});

// Expected scope identities come from the retained ordinary CI requests, not
// from the implementation's future declaration: an omitted or mistyped scope
// must fail the real provider-stack test.
describe('chat-stage explicitly empty single drafts', () => {
	const stageScopes = [
		'scope:!sonnenblume-4711:oriso.invalid|thread:main',
		'scope:4711|thread:main',
		'scope:!supervision-4711:oriso.invalid|thread:main',
		'scope:!sonnenblume-4711:oriso.invalid|thread:$m3',
		'scope:4711|thread:$m3',
		'scope:!sonnenblume-4711:oriso.invalid|thread:$thread-2',
		'scope:4711|thread:$thread-2',
		'scope:!team-4711:oriso.invalid|thread:main'
	] as const;

	it('declares all eight observed reads before a real ChatStageProviders child layout effect', async () => {
		const { ChatStageProviders } = await import(
			'../../chatStage/__storybook__/ChatStageProviders'
		);
		const reads: Promise<Response>[] = [];
		const Child = () => {
			React.useLayoutEffect(() => {
				for (const scope of stageScopes)
					reads.push(fetch(readUrl(scope)));
			}, []);
			return null;
		};
		const view = render(
			<ChatStageProviders>
				<Child />
			</ChatStageProviders>
		);
		expect(reads).toHaveLength(8);
		const responses = await Promise.all(reads);
		for (const response of responses) {
			expect(response.status).toBe(204);
			await expect(response.text()).resolves.toBe('');
		}
		expect(delegate).not.toHaveBeenCalled();
		view.unmount();
		expect(globalThis.fetch).toBe(delegate);
	});

	it('keeps the default three scopes and rejects every stage scope without explicit opt-in', async () => {
		const finish = beginStoryVerification();
		const dispose = await install();
		for (const scope of [
			'scope:360|thread:main',
			'scope:361|thread:main',
			'scope:9001|thread:main'
		]) {
			expect((await fetch(readUrl(scope))).status).toBe(204);
		}
		for (const scope of stageScopes) {
			await expect(fetch(readUrl(scope))).rejects.toThrow(
				'Unexpected product API request: GET'
			);
		}
		expect(delegate).toHaveBeenCalledTimes(8);
		await expect(finish.complete()).rejects.toThrow(
			'unexpected-request: GET'
		);
		dispose();
	});

	const rejectedStageReads = [
		[
			'wrong origin',
			readUrl(stageScopes[0]).replace(
				'api.storybook.test',
				'foreign.storybook.test'
			),
			'GET'
		],
		[
			'plural path',
			`https://api.storybook.test/service/users/drafts?scopeKey=${encodeURIComponent(stageScopes[0])}`,
			'GET'
		],
		[
			'foreign scope',
			readUrl('scope:!foreign:oriso.invalid|thread:main'),
			'GET'
		],
		['missing query', endpoint, 'GET'],
		['extra query', `${readUrl(stageScopes[0])}&other=1`, 'GET'],
		[
			'duplicate query',
			`${readUrl(stageScopes[0])}&scopeKey=${encodeURIComponent(stageScopes[0])}`,
			'GET'
		],
		['fragment', `${readUrl(stageScopes[0])}#other`, 'GET'],
		['write', readUrl(stageScopes[0]), 'POST']
	];
	it.each(rejectedStageReads)(
		'preserves strict rejection for %s with stage opt-in',
		async (_name, url, method) => {
			const fixture = await import('./composerStoryDecorator');
			const finish = beginStoryVerification();
			const dispose = fixture.installComposerSingleDraftFixture({
				emptyDraftScopes: stageScopes
			});
			const input = new Request(url, { method });
			const init = { signal: new AbortController().signal };
			await expect(fetch(input, init)).rejects.toThrow(
				`Unexpected product API request: ${method} ${url}`
			);
			expect(delegate).toHaveBeenCalledExactlyOnceWith(input, init);
			await expect(finish.complete()).rejects.toThrow(
				`unexpected-request: ${method} ${url}`
			);
			dispose();
		}
	);

	it('snapshots caller scopes and retires held A through ordinary B and stage A again', async () => {
		const fixture = await import('./composerStoryDecorator');
		const declared = [...stageScopes];
		const disposeA = fixture.installComposerSingleDraftFixture({
			emptyDraftScopes: declared
		});
		declared.splice(0);
		const heldA = globalThis.fetch;
		expect((await fetch(readUrl(stageScopes[0]))).status).toBe(204);
		disposeA();
		const finish = beginStoryVerification();
		const disposeB = fixture.installComposerSingleDraftFixture();
		const heldB = globalThis.fetch;
		disposeA();
		expect(globalThis.fetch).toBe(heldB);
		await expect(fetch(readUrl(stageScopes[0]))).rejects.toThrow(
			'Unexpected product API request: GET'
		);
		await expect(heldA(readUrl(stageScopes[0]))).rejects.toThrow(
			'Unexpected product API request: GET'
		);
		await expect(finish.complete()).rejects.toThrow(
			'unexpected-request: GET'
		);
		disposeB();
		const disposeAgain = fixture.installComposerSingleDraftFixture({
			emptyDraftScopes: stageScopes
		});
		expect((await fetch(readUrl(stageScopes[7]))).status).toBe(204);
		disposeAgain();
		disposeAgain();
		expect(globalThis.fetch).toBe(delegate);
	});

	it('keeps stage declarations stable through StrictMode rerender and preserves a later foreign fetch owner', async () => {
		const { ComposerStoryDecorator } = await import(
			'./composerStoryDecorator'
		);
		const reads: Promise<Response>[] = [];
		const Child = ({ scope }: { scope: string }) => {
			React.useLayoutEffect(() => {
				reads.push(fetch(readUrl(scope)));
			}, [scope]);
			return null;
		};
		const scene = (scope: string) => (
			<React.StrictMode>
				<ComposerStoryDecorator emptyDraftScopes={stageScopes}>
					<Child scope={scope} />
				</ComposerStoryDecorator>
			</React.StrictMode>
		);
		const view = render(scene(stageScopes[0]));
		view.rerender(scene(stageScopes[7]));
		expect(reads.length).toBeGreaterThanOrEqual(3);
		for (const response of await Promise.all(reads))
			expect(response.status).toBe(204);
		expect(delegate).not.toHaveBeenCalled();
		const foreign = vi.fn<typeof fetch>();
		globalThis.fetch = foreign;
		view.unmount();
		expect(globalThis.fetch).toBe(foreign);
	});
});

describe('composer empty draft scope malformed queries', () => {
	it.each([
		['missing scopeKey', `${endpoint}?other=1`],
		['empty scopeKey', `${endpoint}?scopeKey=`]
	])(
		'delegates %s despite an explicitly declared empty scope',
		async (_name, url) => {
			const fixture = await import('./composerStoryDecorator');
			const finish = beginStoryVerification();
			const dispose = fixture.installComposerSingleDraftFixture({
				emptyDraftScopes: ['']
			});
			const input = new Request(url);
			const init = {
				method: 'GET',
				signal: new AbortController().signal
			};
			try {
				await expect(fetch(input, init)).rejects.toThrow(
					`Unexpected product API request: GET ${url}`
				);
				expect(delegate).toHaveBeenCalledExactlyOnceWith(input, init);
				await expect(finish.complete()).rejects.toThrow(
					`unexpected-request: GET ${url}`
				);
			} finally {
				dispose();
			}
		}
	);
});
