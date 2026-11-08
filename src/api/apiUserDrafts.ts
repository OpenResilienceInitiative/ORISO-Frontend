import { getValueFromCookie } from '../components/sessionCookie/accessSessionCookie';
import { isPracticeDraftScope } from '../practice/practiceDraftScopes';
import { getPracticeSnapshot } from '../practice/practiceMode';
import { endpoints } from '../resources/scripts/endpoints';
import {
	DRAFTS_UPDATED_EVENT,
	REMOTE_DRAFT_INDEX_SCOPE
} from '../services/draftStore';
import { getDraftCryptographyForWindow } from '../services/draftCryptographyWindow';
import { isOpaqueDraftScope } from '../services/draftCryptography';
import {
	fetchData,
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS
} from './fetchData';

export interface IUserDraftItem {
	id?: number;
	scopeKey: string;
	opaqueScopeKey?: string;
	text: string;
	actionPath?: string | null;
	title?: string | null;
	sourceSessionId?: number | null;
	roomRef?: string | null;
	threadRootId?: string | null;
	updatedAt?: string | null;
}

export interface IUserDraftFeedResponse {
	items: IUserDraftItem[];
	page: number;
	perPage: number;
}

type DraftContent = Omit<
	IUserDraftItem,
	'id' | 'scopeKey' | 'opaqueScopeKey' | 'updatedAt'
>;
type WireDraft = IUserDraftItem & { revision?: string };
type WireFeed = Omit<IUserDraftFeedResponse, 'items'> & { items: WireDraft[] };
type DraftSession = {
	crypto: NonNullable<ReturnType<typeof getDraftCryptographyForWindow>>;
	authorization: string;
};

const revisionPattern = /^[A-Za-z0-9_-]{43}$/;
const protectedPageSize = 12;
const maxFeedSize = 200;

const isLogicalScope = (value: string): boolean =>
	/^scope:[^|\s]+\|thread:[^|\s]+$/.test(value);

const currentSession = (): DraftSession | null => {
	const crypto = getDraftCryptographyForWindow();
	const accessToken = getValueFromCookie('keycloak');
	return crypto && accessToken
		? { crypto, authorization: `Bearer ${accessToken}` }
		: null;
};

const assertSession = (session: DraftSession, signal?: AbortSignal): void => {
	if (
		signal?.aborted ||
		getDraftCryptographyForWindow() !== session.crypto ||
		`Bearer ${getValueFromCookie('keycloak')}` !== session.authorization ||
		getPracticeSnapshot().status !== 'inactive'
	) {
		throw new Error('Draft session changed');
	}
};

const request = async <T>(
	session: DraftSession,
	path: string,
	method: string,
	signal?: AbortSignal,
	body?: object,
	emptyIsMissing = false
): Promise<T> => {
	assertSession(session, signal);
	const result = await fetchData({
		url: endpoints.userDrafts + path,
		method,
		headersData: { Authorization: session.authorization },
		skipAuth: true,
		recoverOnPublicAuthRoute: false,
		referrerPolicy: 'no-referrer',
		responseHandling: [
			FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE,
			FETCH_SUCCESS.CONTENT,
			...(emptyIsMissing ? [FETCH_ERRORS.EMPTY] : [])
		],
		...(body ? { bodyData: JSON.stringify(body) } : {}),
		...(signal ? { signal } : {})
	});
	assertSession(session, signal);
	return result as T;
};

const readSingle = async (
	session: DraftSession,
	scope: string,
	signal?: AbortSignal
) => {
	try {
		const row = await request<WireDraft>(
			session,
			'/single?scopeKey=' + encodeURIComponent(scope),
			FETCH_METHODS.GET,
			signal,
			undefined,
			true
		);
		if (row.scopeKey !== scope)
			throw new Error('Draft response scope changed');
		return row;
	} catch (error) {
		if (error instanceof Error && error.message === FETCH_ERRORS.EMPTY)
			return null;
		throw error;
	}
};

const readPage = async (
	session: DraftSession,
	page: number,
	signal?: AbortSignal
): Promise<WireDraft[]> => {
	const result = await request<WireFeed>(
		session,
		`/protected?page=${page}&perPage=${protectedPageSize}`,
		FETCH_METHODS.GET,
		signal
	);
	if (
		result?.page !== page ||
		result.perPage !== protectedPageSize ||
		!Array.isArray(result.items) ||
		result.items.length > protectedPageSize
	) {
		throw new Error('Invalid protected draft feed page');
	}
	return result.items;
};

const readFeed = async (
	session: DraftSession,
	page: number,
	perPage: number
): Promise<WireDraft[]> => {
	const start = page * perPage;
	const end = start + perPage;
	const rows: WireDraft[] = [];
	// Finish reading offsets before this client migrates rows and changes their order.
	for (
		let offset = Math.floor(start / protectedPageSize) * protectedPageSize;
		offset < end;
		offset += protectedPageSize
	) {
		const items = await readPage(session, offset / protectedPageSize);
		rows.push(...items.slice(Math.max(0, start - offset), end - offset));
		if (items.length < protectedPageSize) break;
	}
	return rows;
};

const safeActionPath = (value?: string | null): string | null => {
	if (
		!value?.startsWith('/sessions/') ||
		value.includes('\\') ||
		[...value].some((character) => character.charCodeAt(0) < 32)
	)
		return null;
	const url = new URL(value, 'https://draft.invalid');
	if (
		url.origin !== 'https://draft.invalid' ||
		!url.pathname.startsWith('/sessions/')
	)
		return null;
	url.searchParams.delete('draftScopeKey');
	url.searchParams.delete('embeddedNotifications');
	return url.pathname + url.search;
};

const content = (item: DraftContent): DraftContent => ({
	text: item.text,
	actionPath: safeActionPath(item.actionPath),
	title: item.title ?? null,
	sourceSessionId: Number.isSafeInteger(item.sourceSessionId)
		? item.sourceSessionId
		: null,
	roomRef: item.roomRef ?? null,
	threadRootId: item.threadRootId ?? null
});

const validContent = (
	value: unknown
): value is DraftContent & { scopeKey: string } => {
	if (!value || typeof value !== 'object') return false;
	const item = value as Partial<DraftContent & { scopeKey: string }>;
	return (
		typeof item.scopeKey === 'string' &&
		isLogicalScope(item.scopeKey) &&
		typeof item.text === 'string' &&
		[item.actionPath, item.title, item.roomRef, item.threadRootId].every(
			(field) => field == null || typeof field === 'string'
		) &&
		(item.sourceSessionId == null ||
			Number.isSafeInteger(item.sourceSessionId))
	);
};

const openProtectedDraft = async (
	session: DraftSession,
	row: WireDraft
): Promise<IUserDraftItem | null> => {
	if (!isOpaqueDraftScope(row.scopeKey)) return null;
	try {
		const opened = await session.crypto.open(row.scopeKey, row.text);
		if (
			!validContent(opened) ||
			(await session.crypto.opaqueScope(opened.scopeKey)) !== row.scopeKey
		)
			return null;
		return {
			...content(opened),
			scopeKey: opened.scopeKey,
			opaqueScopeKey: row.scopeKey,
			id: row.id,
			updatedAt: row.updatedAt
		};
	} catch {
		return null;
	}
};

const legacyDraft = (row: WireDraft) =>
	typeof row.scopeKey === 'string' &&
	isLogicalScope(row.scopeKey) &&
	typeof row.text === 'string' &&
	!row.text.startsWith('enc.') &&
	!/^draft\.v\d+\./i.test(row.text);

const findLegacy = async (
	session: DraftSession,
	requested: string,
	signal?: AbortSignal
) => {
	for (let page = 0; ; page++) {
		const items = await readPage(session, page, signal);
		for (const row of items) {
			if (
				legacyDraft(row) &&
				(row.scopeKey === requested ||
					(isOpaqueDraftScope(requested) &&
						(await session.crypto.opaqueScope(row.scopeKey)) ===
							requested))
			) {
				return row;
			}
		}
		if (items.length < protectedPageSize) return null;
	}
};

const withLegacyIndexMetadata = async (
	session: DraftSession,
	row: WireDraft,
	signal?: AbortSignal
): Promise<DraftContent> => {
	if (
		row.scopeKey === REMOTE_DRAFT_INDEX_SCOPE ||
		(row.actionPath && row.sourceSessionId != null)
	) {
		return content(row);
	}
	try {
		const indexScope = await session.crypto.opaqueScope(
			REMOTE_DRAFT_INDEX_SCOPE
		);
		const sealedIndex = await readSingle(session, indexScope, signal);
		const index = sealedIndex
			? await openProtectedDraft(session, sealedIndex)
			: await findLegacy(session, REMOTE_DRAFT_INDEX_SCOPE, signal);
		if (!index?.text) return content(row);
		const stored = JSON.parse(index.text);
		const entry =
			stored && Object.hasOwn(stored, row.scopeKey)
				? stored[row.scopeKey]
				: null;
		if (!entry || typeof entry !== 'object') return content(row);
		return content({
			...row,
			actionPath:
				row.actionPath ??
				(typeof entry.actionPath === 'string'
					? entry.actionPath
					: null),
			title:
				row.title ??
				(typeof entry.title === 'string' ? entry.title : null),
			sourceSessionId:
				row.sourceSessionId ??
				(Number.isSafeInteger(entry.sessionId)
					? entry.sessionId
					: null),
			roomRef:
				row.roomRef ??
				(typeof entry.roomRef === 'string' ? entry.roomRef : null),
			threadRootId:
				row.threadRootId ??
				(typeof entry.threadRootId === 'string'
					? entry.threadRootId
					: null)
		});
	} catch {
		// A missing old index must not prevent access to the original draft body.
		return content(row);
	}
};

const hasValidLegacyRevision = (
	row: WireDraft
): row is WireDraft & { id: number; revision: string } =>
	typeof row.id === 'number' &&
	Number.isSafeInteger(row.id) &&
	row.id > 0 &&
	typeof row.revision === 'string' &&
	revisionPattern.test(row.revision);

// A list hydration, composer migration and Send cleanup can overlap in one
// document. The provider revisions also protect the same operation across tabs.
const pendingScopes = new WeakMap<
	DraftSession['crypto'],
	Map<string, Promise<unknown>>
>();
const serialScope = <T>(
	session: DraftSession,
	scope: string,
	operation: () => Promise<T>
): Promise<T> => {
	let pending = pendingScopes.get(session.crypto);
	if (!pending) {
		pending = new Map();
		pendingScopes.set(session.crypto, pending);
	}
	const previous = pending.get(scope);
	const current = previous
		? previous.then(operation, operation)
		: operation();
	pending.set(scope, current);
	const release = () => {
		if (pending.get(scope) === current) pending.delete(scope);
	};
	void current.then(release, release);
	return current;
};

const convertLegacyUnlocked = async (
	session: DraftSession,
	row: WireDraft,
	opaqueScopeKey: string,
	signal?: AbortSignal
): Promise<IUserDraftItem | null> => {
	const { scopeKey } = row;
	const clear = {
		scopeKey,
		...(await withLegacyIndexMetadata(session, row, signal))
	};
	const visible = {
		...clear,
		opaqueScopeKey,
		id: row.id,
		updatedAt: row.updatedAt
	};
	try {
		let protectedRow = await readSingle(session, opaqueScopeKey, signal);
		if (!protectedRow && hasValidLegacyRevision(row)) {
			const text = await session.crypto.seal(opaqueScopeKey, clear);
			try {
				await request(session, '/migrate', FETCH_METHODS.POST, signal, {
					legacyId: row.id,
					legacyRevision: row.revision,
					targetScopeKey: opaqueScopeKey,
					text
				});
			} catch (error) {
				if (!(error instanceof Response && error.status === 409))
					throw error;
			}
			protectedRow = await readSingle(session, opaqueScopeKey, signal);
		}
		if (!protectedRow) return visible;
		const opened = await openProtectedDraft(session, protectedRow);
		if (!opened) return visible;
		if (
			hasValidLegacyRevision(row) &&
			typeof protectedRow.revision === 'string' &&
			revisionPattern.test(protectedRow.revision) &&
			JSON.stringify(clear) ===
				JSON.stringify({
					scopeKey: opened.scopeKey,
					...content(opened)
				})
		) {
			const params = new URLSearchParams({
				revision: row.revision,
				targetScopeKey: opaqueScopeKey,
				targetRevision: protectedRow.revision
			});
			await request(
				session,
				`/legacy/${row.id}?${params}`,
				FETCH_METHODS.DELETE,
				signal
			).catch(() => {});
		}
		return opened;
	} catch (error) {
		if (
			error instanceof Response &&
			error.status === 404 &&
			hasValidLegacyRevision(row)
		) {
			// A capable provider can report the source was removed. Retain legacy
			// usability while rolling out by checking the authenticated list again.
			const current = await findLegacy(
				session,
				row.scopeKey,
				signal
			).catch(() => row);
			if (!current) return null;
		}
		// A failed migration keeps the original. The authenticated author can still read it.
		return visible;
	}
};

const convertLegacy = async (
	session: DraftSession,
	row: WireDraft,
	signal?: AbortSignal
) => {
	const opaque = await session.crypto.opaqueScope(row.scopeKey);
	return serialScope(session, opaque, () =>
		convertLegacyUnlocked(session, row, opaque, signal)
	);
};

const practiceRequest = <T>(
	scope: string | null,
	path: string,
	method: string,
	signal?: AbortSignal,
	body?: object
): Promise<T> => {
	// Practice installs its deny-by-default fetch guard before becoming active.
	// Only its synthetic scopes go through the fake backend, without real credentials.
	const practice = getPracticeSnapshot();
	if (
		practice.status !== 'active' ||
		signal?.aborted ||
		(scope &&
			scope !== REMOTE_DRAFT_INDEX_SCOPE &&
			!isPracticeDraftScope(scope))
	) {
		return Promise.reject(
			new Error('Draft unavailable in this practice context')
		);
	}
	return fetchData({
		url: endpoints.userDrafts + path,
		method,
		skipAuth: true,
		recoverOnPublicAuthRoute: false,
		responseHandling: [
			FETCH_ERRORS.EMPTY,
			FETCH_ERRORS.CATCH_ALL,
			FETCH_SUCCESS.CONTENT
		].filter(
			(handling) =>
				handling !== FETCH_ERRORS.EMPTY || path.startsWith('/single')
		),
		...(body ? { bodyData: JSON.stringify(body) } : {}),
		...(signal ? { signal } : {})
	}).then((value) => {
		if (getPracticeSnapshot() !== practice || signal?.aborted)
			throw new Error('Practice draft session changed');
		return value as T;
	});
};

export const apiFetchUserDrafts = async (
	page = 0,
	perPage = 200
): Promise<IUserDraftFeedResponse> => {
	if (getPracticeSnapshot().status !== 'inactive') {
		return practiceRequest(
			null,
			`?page=${page}&perPage=${perPage}`,
			FETCH_METHODS.GET
		);
	}
	const session = currentSession();
	if (!session) return { items: [], page, perPage };
	const size = Math.min(perPage, maxFeedSize);
	if (
		!Number.isSafeInteger(page) ||
		page < 0 ||
		!Number.isInteger(size) ||
		size < 1
	) {
		throw new Error('Invalid draft feed range');
	}
	const rows = await readFeed(session, page, size);
	const items = new Map<string, IUserDraftItem>();
	for (const row of rows) {
		const opened = legacyDraft(row)
			? await convertLegacy(session, row)
			: await openProtectedDraft(session, row);
		if (opened) {
			const existing = items.get(opened.scopeKey);
			if (
				!existing ||
				String(opened.updatedAt ?? '') >
					String(existing.updatedAt ?? '')
			) {
				items.set(opened.scopeKey, opened);
			}
		}
	}
	assertSession(session);
	return { page, perPage: size, items: [...items.values()] };
};

export const apiGetUserDrafts = async (
	page = 0,
	perPage = 200
): Promise<IUserDraftFeedResponse> => {
	try {
		return await apiFetchUserDrafts(page, perPage);
	} catch {
		return { items: [], page, perPage };
	}
};

export const apiGetUserDraft = async (
	scopeKey: string,
	signal?: AbortSignal
): Promise<IUserDraftItem | null> => {
	try {
		if (getPracticeSnapshot().status !== 'inactive') {
			return await practiceRequest(
				scopeKey,
				'/single?scopeKey=' + encodeURIComponent(scopeKey),
				FETCH_METHODS.GET,
				signal
			);
		}
		const session = currentSession();
		if (
			!session ||
			!(isOpaqueDraftScope(scopeKey) || isLogicalScope(scopeKey))
		)
			return null;
		const opaque = isOpaqueDraftScope(scopeKey)
			? scopeKey
			: await session.crypto.opaqueScope(scopeKey);
		const protectedRow = await readSingle(session, opaque, signal);
		if (protectedRow) {
			const opened = await openProtectedDraft(session, protectedRow);
			assertSession(session, signal);
			return opened;
		}
		const old = await findLegacy(session, scopeKey, signal);
		if (!old) throw new Error(FETCH_ERRORS.EMPTY);
		const opened = await convertLegacy(session, old, signal);
		assertSession(session, signal);
		return opened;
	} catch (error) {
		if (error instanceof Error && error.message === FETCH_ERRORS.EMPTY)
			throw error;
		return null;
	}
};

export const apiUpsertUserDraft = async (
	scopeKey: string,
	payload: DraftContent,
	signal?: AbortSignal
): Promise<void> => {
	try {
		if (getPracticeSnapshot().status !== 'inactive') {
			await practiceRequest(
				scopeKey,
				'?scopeKey=' + encodeURIComponent(scopeKey),
				FETCH_METHODS.PATCH,
				signal,
				payload
			);
		} else {
			const session = currentSession();
			if (!session || !isLogicalScope(scopeKey)) return;
			const opaque = await session.crypto.opaqueScope(scopeKey);
			await serialScope(session, opaque, async () => {
				const text = await session.crypto.seal(opaque, {
					scopeKey,
					...content(payload)
				});
				await request(
					session,
					'/protected?scopeKey=' + encodeURIComponent(opaque),
					FETCH_METHODS.PATCH,
					signal,
					{ text }
				);
			});
			assertSession(session, signal);
		}
		window.dispatchEvent(new Event(DRAFTS_UPDATED_EVENT));
	} catch {
		// Autosave cannot send plaintext or break the composer when recovery/network is unavailable.
	}
};

export const apiDeleteUserDraft = async (
	scopeKey: string,
	signal?: AbortSignal
): Promise<void> => {
	try {
		if (getPracticeSnapshot().status !== 'inactive') {
			await practiceRequest(
				scopeKey,
				'?scopeKey=' + encodeURIComponent(scopeKey),
				FETCH_METHODS.DELETE,
				signal
			);
		} else {
			const session = currentSession();
			if (
				!session ||
				!(isOpaqueDraftScope(scopeKey) || isLogicalScope(scopeKey))
			)
				return;
			const opaque = isOpaqueDraftScope(scopeKey)
				? scopeKey
				: await session.crypto.opaqueScope(scopeKey);
			const deleted = await serialScope(session, opaque, async () => {
				const legacy = await findLegacy(session, scopeKey, signal);
				if (legacy) {
					await convertLegacyUnlocked(
						session,
						legacy,
						opaque,
						signal
					);
					// Leave the verified copy available if an older row could otherwise
					// become visible again after Send or discard.
					if (await findLegacy(session, scopeKey, signal))
						return false;
				}
				await request(
					session,
					'/protected?scopeKey=' + encodeURIComponent(opaque),
					FETCH_METHODS.DELETE,
					signal
				);
				return true;
			});
			assertSession(session, signal);
			if (!deleted) return;
		}
		window.dispatchEvent(new Event(DRAFTS_UPDATED_EVENT));
	} catch {
		// Preserve the original if the exact authenticated deletion cannot complete.
	}
};
