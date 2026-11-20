// @vitest-environment oriso-jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test';
import {
	deleteCookieByName,
	setValueInCookie
} from '../components/sessionCookie/accessSessionCookie';
import type { DraftCryptography } from './draftCryptography';
import {
	getDraftAuthSessionIdentity,
	registerDraftCryptographyFrame
} from './draftCryptographyWindow';

const mocks = vi.hoisted(() => ({
	getCrypto: vi.fn(),
	subscribe: vi.fn(() => () => {})
}));

vi.mock('./draftCryptography', () => ({
	getDraftCryptography: mocks.getCrypto,
	subscribeDraftCryptography: mocks.subscribe,
	isOpaqueDraftScope: (value: unknown): value is string =>
		typeof value === 'string' &&
		/^draft\.v1\.[A-Za-z0-9_-]{43}$/.test(value)
}));

const makeFrame = (src: string) => {
	const frame = document.createElement('iframe');
	frame.src = src;
	document.body.appendChild(frame);
	return frame;
};

const auth = (sid: string) =>
	setValueInCookie(
		'keycloak',
		`x.${btoa(JSON.stringify({ iss: 'issuer', sub: 'subject', sid }))}.x`
	);

const resolve = (source: Window, identity = getDraftAuthSessionIdentity()) => {
	const reader = Reflect.get(
		window,
		Symbol.for('oriso.draftCryptographyFrame')
	);
	return reader?.(source, identity) as {
		get: () => DraftCryptography | null;
	} | null;
};

const token = 'draft.v1.' + 'a'.repeat(43);
const otherToken = 'draft.v1.' + 'b'.repeat(43);
const route = `/sessions/user/view/session/12?embeddedNotifications=1&draftScopeKey=${token}`;
let unregister: (() => void) | undefined;

beforeEach(() => {
	auth('test-session');
});

afterEach(() => {
	unregister?.();
	unregister = undefined;
	deleteCookieByName('keycloak');
	document.querySelectorAll('iframe').forEach((frame) => frame.remove());
	mocks.getCrypto.mockReset();
});

it('only grants the exact registered frame and matching app session a stable operations adapter', async () => {
	const backend = {
		opaqueScope: vi.fn(async () => 'opaque'),
		open: vi.fn(),
		seal: vi.fn(),
		rawKey: 'hidden'
	};
	mocks.getCrypto.mockReturnValue(backend);
	const frame = makeFrame(route);
	const sibling = makeFrame(route);
	unregister = registerDraftCryptographyFrame(frame);
	const source = frame.contentWindow!;
	const capability = resolve(source)?.get();
	expect(capability).not.toBe(backend);
	expect(Object.keys(capability ?? {})).toEqual([
		'opaqueScope',
		'seal',
		'open'
	]);
	expect(resolve(source)?.get()).toBe(capability);
	expect(resolve(sibling.contentWindow!)).toBeNull();
	expect(resolve(source, 'wrong identity')).toBeNull();
	await expect(capability?.opaqueScope('logical')).resolves.toBe('opaque');
	expect(backend.opaqueScope).toHaveBeenCalledWith('logical');
});

it('rejects expired, navigated, unregistered and replaced frame capabilities', async () => {
	let finish!: (value: string) => void;
	const pending = new Promise<string>((resolve) => {
		finish = resolve;
	});
	mocks.getCrypto.mockReturnValue({
		opaqueScope: () => pending,
		open: vi.fn(),
		seal: vi.fn()
	});
	const frame = makeFrame(route);
	unregister = registerDraftCryptographyFrame(frame);
	const source = frame.contentWindow!;
	const capability = resolve(source)?.get()!;
	const result = capability.opaqueScope('logical');

	source.history.replaceState(
		null,
		'',
		route.replace('/session/12?', '/session/99?')
	);
	expect(resolve(source)).toBeNull();
	finish('should not return');
	await expect(result).rejects.toThrow('Draft access ended');

	source.history.replaceState(null, '', route);
	const retained = resolve(source)?.get()!;
	deleteCookieByName('keycloak');
	auth('test-session');
	expect(resolve(source)).toBeNull();
	await expect(retained.opaqueScope('logical')).rejects.toThrow(
		'Draft access ended'
	);

	unregister();
	expect(resolve(source)).toBeUndefined();
	const other = makeFrame(
		'/sessions/user/view/session/12?embeddedNotifications=0'
	);
	unregister = registerDraftCryptographyFrame(other);
	expect(resolve(other.contentWindow!)).toBeUndefined();
});

it('keeps the same capability while the route normalizes a thread and consumes its jump', async () => {
	mocks.getCrypto.mockReturnValue({
		opaqueScope: vi.fn(async () => 'opaque'),
		open: vi.fn(),
		seal: vi.fn()
	});
	const frame = makeFrame(
		route + '&threadRootId=%24root&threadMessageId=%24jump&keep=1'
	);
	unregister = registerDraftCryptographyFrame(frame);
	const source = frame.contentWindow!;
	const originalDocument = source.document;
	const capability = resolve(source)?.get();
	expect(capability).toBeTruthy();

	const canonical = route + '&keep=1&channel=thread%3A%24root';
	source.history.replaceState(null, '', canonical + '&at=%24jump');
	expect(source.document).toBe(originalDocument);
	expect(resolve(source)?.get()).toBe(capability);
	source.history.replaceState(null, '', canonical);
	expect(resolve(source)?.get()).toBe(capability);
	await expect(capability?.opaqueScope('logical')).resolves.toBe('opaque');

	for (const changed of [
		canonical.replace(token, otherToken),
		canonical.replace('%24root', '%24different'),
		canonical.replace('keep=1', 'keep=2'),
		canonical + '&at=%24different',
		canonical + '&draftScopeKey=' + token
	]) {
		source.history.replaceState(null, '', changed);
		expect(resolve(source)).toBeNull();
	}
});

it('accepts only the equivalent legacy team route and denies foreign frames', () => {
	mocks.getCrypto.mockReturnValue({
		opaqueScope: vi.fn(),
		open: vi.fn(),
		seal: vi.fn()
	});
	const frame = makeFrame(route + '&teamDiscussion=1&at=%24jump');
	unregister = registerDraftCryptographyFrame(frame);
	const source = frame.contentWindow!;
	const capability = resolve(source)?.get();
	source.history.replaceState(null, '', route + '&channel=team');
	expect(capability).toBeTruthy();
	expect(resolve(source)?.get()).toBe(capability);
	source.history.replaceState(null, '', route + '&channel=supervision');
	expect(resolve(source)).toBeNull();

	unregister();
	const foreign = makeFrame('https://other.example' + route);
	unregister = registerDraftCryptographyFrame(foreign);
	expect(resolve(foreign.contentWindow!)).toBeUndefined();
});

it('does not switch an already selected thread to team via a conflicting legacy flag', () => {
	const frame = makeFrame(route + '&threadRootId=%24root&teamDiscussion=1');
	unregister = registerDraftCryptographyFrame(frame);
	const source = frame.contentWindow!;
	expect(resolve(source)).toBeTruthy();
	source.history.replaceState(null, '', route + '&channel=team');
	expect(resolve(source)).toBeNull();
});
