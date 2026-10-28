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

	const replace = (link: DirectLink) =>
		setLinks((all) =>
			all.map((item) => (item.id === link.id ? link : item))
		);

	/* Optimistic: the tile greys out at once and flips back if the server says no. */
	const toggle = useCallback(async (id: string, active: boolean) => {
		setToggleFailed(false);
		setLinks((all) =>
			all.map((item) => (item.id === id ? { ...item, active } : item))
		);
		try {
			replace(await apiUpdateDirectLink(id, { active }));
		} catch {
			setLinks((all) =>
				all.map((item) =>
					item.id === id ? { ...item, active: !active } : item
				)
			);
			setToggleFailed(true);
		}
	}, []);

	const update = useCallback(async (id: string, change: DirectLinkUpdate) => {
		const saved = await apiUpdateDirectLink(id, change);
		replace(saved);
		return saved;
	}, []);

	return { links, state, toggleFailed, reload, toggle, update };
};
