import { useCallback, useEffect, useRef, useState } from 'react';
import {
	apiGetOwnDirectLinks,
	apiUpdateDirectLink,
	DIRECT_LINKS_CHANGED_EVENT,
	DirectLinkUpdate
} from '../../api/apiDirectLinks';
import { DirectLink } from '../conversationCreate/directLink/directLink';

export type DirectLinksLoadState = 'loading' | 'ready' | 'failed';

/**
 * #1894: the counsellor's direct links for the clock page and
 * Settings → "Meine Links". Reloads when "Create chat" announces a new link.
 */
export const useMyDirectLinks = () => {
	const [links, setLinks] = useState<DirectLink[]>([]);
	const [state, setState] = useState<DirectLinksLoadState>('loading');
	const [toggleFailed, setToggleFailed] = useState(false);
	const request = useRef(0);

	const reload = useCallback(() => {
		const current = ++request.current;
		apiGetOwnDirectLinks()
			.then((result) => {
				if (current !== request.current) return;
				setLinks(result);
				setState('ready');
			})
			.catch(() => {
				if (current !== request.current) return;
				setState((previous) =>
					previous === 'ready' ? previous : 'failed'
				);
			});
	}, []);

	// Answers that arrive after unmount must not set state.
	const invalidate = useCallback(() => {
		request.current++;
	}, []);

	useEffect(() => {
		reload();
		window.addEventListener(DIRECT_LINKS_CHANGED_EVENT, reload);
		return () => {
			invalidate();
			window.removeEventListener(DIRECT_LINKS_CHANGED_EVENT, reload);
		};
	}, [invalidate, reload]);

	const replace = useCallback(
		(link: DirectLink) =>
			setLinks((all) =>
				all.map((item) => (item.id === link.id ? link : item))
			),
		[]
	);

	// One request per link at a time; its switch waits for the answer.
	const linksRef = useRef(links);
	linksRef.current = links;
	const pendingRef = useRef(new Set<string>());
	const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
		() => new Set()
	);
	const setPending = useCallback((id: string, pending: boolean) => {
		if (pending) pendingRef.current.add(id);
		else pendingRef.current.delete(id);
		setPendingIds(new Set(pendingRef.current));
	}, []);

	/* Optimistic: the tile greys out at once and flips back if the server says no. */
	const toggle = useCallback(
		async (id: string, active: boolean) => {
			if (pendingRef.current.has(id)) return;
			const before =
				linksRef.current.find((item) => item.id === id)?.active ??
				!active;
			const set = (value: boolean) =>
				setLinks((all) =>
					all.map((item) =>
						item.id === id ? { ...item, active: value } : item
					)
				);
			setPending(id, true);
			setToggleFailed(false);
			set(active);
			try {
				replace(await apiUpdateDirectLink(id, { active }));
			} catch {
				set(before);
				setToggleFailed(true);
			} finally {
				setPending(id, false);
			}
		},
		[replace, setPending]
	);

	const update = useCallback(
		async (id: string, change: DirectLinkUpdate) => {
			const saved = await apiUpdateDirectLink(id, change);
			replace(saved);
			return saved;
		},
		[replace]
	);

	return { links, state, toggleFailed, pendingIds, reload, toggle, update };
};
