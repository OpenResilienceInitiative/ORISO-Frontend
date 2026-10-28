import { useCallback, useEffect, useRef, useState } from 'react';
import {
	apiCreateDirectLink,
	apiGetDirectLinks,
	apiUpdateDirectLink,
	CreateDirectLinkBody,
	toDirectLink
} from '../../../api/apiDirectLinks';
import { DirectLink } from './directLink';

export interface DirectLinksState {
	links: DirectLink[];
	/** The first list request has answered (either way). */
	loaded: boolean;
	loadFailed: boolean;
	reload: () => void;
	/** Resolves with the new link; rejects when the backend refused. */
	create: (body: CreateDirectLinkBody) => Promise<DirectLink>;
	/** Optimistic; the switch goes back when the backend refuses. */
	toggle: (id: string, active: boolean) => Promise<void>;
}

/**
 * The counsellor's own direct links (ORISO-UserService#1479): list, create,
 * switch on and off. Each surface that shows them loads them itself; there is
 * no shared cache, so a link made in "Create chat" is listed the next time the
 * overview mounts.
 */
export const useDirectLinks = ({ load = true } = {}): DirectLinksState => {
	const [links, setLinks] = useState<DirectLink[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [loadFailed, setLoadFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	useEffect(() => {
		if (!load) return;
		let cancelled = false;
		apiGetDirectLinks()
			.then((list) => {
				if (cancelled) return;
				setLinks(list.map(toDirectLink));
				setLoadFailed(false);
			})
			.catch(() => {
				if (!cancelled) setLoadFailed(true);
			})
			.finally(() => {
				if (!cancelled) setLoaded(true);
			});
		return () => {
			cancelled = true;
		};
	}, [load, attempt]);

	const reload = useCallback(() => setAttempt((count) => count + 1), []);

	const create = useCallback(async (body: CreateDirectLinkBody) => {
		const link = toDirectLink(await apiCreateDirectLink(body));
		if (mounted.current) setLinks((current) => [link, ...current]);
		return link;
	}, []);

	const toggle = useCallback(async (id: string, active: boolean) => {
		const flip = (value: boolean) =>
			setLinks((current) =>
				current.map((link) =>
					link.id === id ? { ...link, active: value } : link
				)
			);
		flip(active);
		try {
			await apiUpdateDirectLink(id, { active });
		} catch {
			if (mounted.current) flip(!active);
		}
	}, []);

	return { links, loaded, loadFailed, reload, create, toggle };
};
