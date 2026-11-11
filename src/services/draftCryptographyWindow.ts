import { AUTH_SESSION_CHANGE_EVENT } from '../components/sessionCookie/accessSessionCookie';
import {
	CHANNEL_PARAM,
	TEAM_CHANNEL_ID,
	normalizeLegacyChannelSearch,
	stripAtParam
} from '../utils/channelRoute';
import { getDraftAuthSessionIdentity } from './draftAuthSession';
import {
	getDraftCryptography,
	isOpaqueDraftScope,
	subscribeDraftCryptography,
	type DraftCryptography
} from './draftCryptography';

const frameBridgeKey = Symbol.for('oriso.draftCryptographyFrame');

interface FrameDraftAccess {
	get: () => DraftCryptography | null;
	subscribe: (listener: () => void) => () => void;
}

type DraftWindow = Window & {
	[frameBridgeKey]?: (
		source: Window,
		identity: string
	) => FrameDraftAccess | null;
};

export { getDraftAuthSessionIdentity } from './draftAuthSession';

const isEmbeddedDraftUrl = (url: URL) => {
	const flags = url.searchParams.getAll('embeddedNotifications');
	const scopes = url.searchParams.getAll('draftScopeKey');
	return (
		flags.length === 1 &&
		flags[0] === '1' &&
		scopes.length === 1 &&
		isOpaqueDraftScope(scopes[0])
	);
};

/** Only forward rewrites the session may apply to this registered search. */
const registeredSearchVariants = (initialSearch: string): Set<string> => {
	const variants = new Set([initialSearch]);
	for (const search of variants) {
		const canonical = normalizeLegacyChannelSearch(search);
		if (canonical !== null) variants.add(canonical);
		variants.add(stripAtParam(search));

		const params = new URLSearchParams(search);
		const channel = new URLSearchParams(canonical ?? search).get(
			CHANNEL_PARAM
		);
		if (
			params.get('teamDiscussion') === '1' &&
			(!channel || channel === TEAM_CHANNEL_ID)
		) {
			params.delete('teamDiscussion');
			params.set(CHANNEL_PARAM, TEAM_CHANNEL_ID);
			variants.add(`?${params.toString()}`);
		}
	}
	return variants;
};

const getParentDraftAccess = () => {
	const identity = getDraftAuthSessionIdentity();
	if (!identity || !isEmbeddedDraftUrl(new URL(window.location.href))) {
		return null;
	}
	try {
		return (
			(window.parent as DraftWindow)[frameBridgeKey]?.(
				window,
				identity
			) ?? null
		);
	} catch {
		// An unrelated cross-origin embed does not have this capability.
		return null;
	}
};

const subscribeAuthIdentity = (listener: () => void) => {
	let identity = getDraftAuthSessionIdentity();
	const check = () => {
		const current = getDraftAuthSessionIdentity();
		if (current !== identity) {
			identity = current;
			listener();
		}
	};
	const cookieStore = (window as Window & { cookieStore?: EventTarget })
		.cookieStore;
	window.addEventListener(AUTH_SESSION_CHANGE_EVENT, check);
	window.addEventListener('storage', check);
	window.addEventListener('focus', check);
	cookieStore?.addEventListener('change', check);
	return () => {
		window.removeEventListener(AUTH_SESSION_CHANGE_EVENT, check);
		window.removeEventListener('storage', check);
		window.removeEventListener('focus', check);
		cookieStore?.removeEventListener('change', check);
	};
};

export const getDraftCryptographyForWindow = (): DraftCryptography | null => {
	if (typeof window === 'undefined') return null;
	return window.parent === window
		? getDraftCryptography()
		: (getParentDraftAccess()?.get() ?? null);
};

export const subscribeDraftCryptographyForWindow = (
	listener: () => void
): (() => void) => {
	if (typeof window === 'undefined') return () => {};
	const removeAuthListener = subscribeAuthIdentity(listener);
	const unsubscribe =
		window.parent === window
			? subscribeDraftCryptography(listener)
			: getParentDraftAccess()?.subscribe(listener);
	return () => {
		removeAuthListener();
		unsubscribe?.();
	};
};

/**
 * A Drafts Center frame can use the parent session's operations without
 * holding a second copy of the key. A navigation invalidates capabilities
 * already handed to that document, even though its WindowProxy stays the same.
 */
export const registerDraftCryptographyFrame = (
	frame: HTMLIFrameElement
): (() => void) => {
	const host = window as DraftWindow;
	const identity = getDraftAuthSessionIdentity();
	const registeredUrl = new URL(frame.src, window.location.href);
	if (
		window.parent !== window ||
		!identity ||
		registeredUrl.origin !== window.location.origin ||
		!isEmbeddedDraftUrl(registeredUrl)
	) {
		return () => {};
	}

	const allowedSearches = registeredSearchVariants(registeredUrl.search);
	const listeners = new Set<() => void>();
	const documentAccess = new WeakMap<Document, FrameDraftAccess>();
	let active = true;
	const notify = () => {
		if (getDraftAuthSessionIdentity() !== identity) active = false;
		listeners.forEach((listener) => listener());
	};
	const unsubscribe = subscribeDraftCryptographyForWindow(notify);
	const resolveAccess = (source: Window, sourceIdentity: string) => {
		const childDocument = frame.contentDocument;
		const isCurrent = () => {
			if (getDraftAuthSessionIdentity() !== identity) active = false;
			if (
				!active ||
				!frame.isConnected ||
				!childDocument ||
				frame.contentWindow !== source ||
				frame.contentDocument !== childDocument ||
				sourceIdentity !== identity
			) {
				return false;
			}
			const currentUrl = new URL(childDocument.URL);
			return (
				currentUrl.origin === registeredUrl.origin &&
				currentUrl.pathname === registeredUrl.pathname &&
				allowedSearches.has(currentUrl.search)
			);
		};
		if (!childDocument || !isCurrent()) return null;
		const existing = documentAccess.get(childDocument);
		if (existing) return existing;
		let previousCapability: DraftCryptography | null = null;
		let adapter: DraftCryptography | null = null;
		const access: FrameDraftAccess = {
			get: () => {
				const capability = getDraftCryptography();
				if (!capability || !isCurrent()) return null;
				if (capability === previousCapability) return adapter;
				previousCapability = capability;
				const operate = async <T>(
					action: (crypto: DraftCryptography) => Promise<T>
				) => {
					const stillCurrent = () =>
						isCurrent() && getDraftCryptography() === capability;
					if (!stillCurrent()) throw new Error('Draft access ended');
					const result = await action(capability);
					if (!stillCurrent()) throw new Error('Draft access ended');
					return result;
				};
				adapter = {
					opaqueScope: (scope) =>
						operate((crypto) => crypto.opaqueScope(scope)),
					seal: (scope, value) =>
						operate((crypto) => crypto.seal(scope, value)),
					open: (scope, envelope) =>
						operate((crypto) => crypto.open(scope, envelope))
				};
				return adapter;
			},
			subscribe: (listener: () => void) => {
				if (!isCurrent()) return () => {};
				const notifyFrame = () => {
					listener();
					if (!isCurrent()) listeners.delete(notifyFrame);
				};
				listeners.add(notifyFrame);
				return () => {
					listeners.delete(notifyFrame);
				};
			}
		};
		documentAccess.set(childDocument, access);
		return access;
	};
	host[frameBridgeKey] = resolveAccess;
	return () => {
		active = false;
		if (host[frameBridgeKey] === resolveAccess) delete host[frameBridgeKey];
		unsubscribe();
		notify();
		listeners.clear();
	};
};
