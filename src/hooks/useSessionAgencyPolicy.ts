import {
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore
} from 'react';
import { apiGetAgenciesByIds } from '../api/apiGetAgenciesByIds';
import type { AgencyDataInterface } from '../globalState/interfaces';
import type { AgencyConversationPolicy } from '../globalState/interfaces/ConversationFeatureSettings';
import {
	getAuthenticatedTenantId,
	subscribeToAuthenticatedTenant
} from '../utils/authenticatedTenant';

/** The one public-agency request for an open conversation, shared by logo and feature gates. */
export const useSessionAgencyPolicy = (
	sessionKey: string | number | undefined,
	agencyId: number | undefined
) => {
	const tenantId = useSyncExternalStore(
		subscribeToAuthenticatedTenant,
		getAuthenticatedTenantId
	);
	const hasAgencyId = Number.isSafeInteger(agencyId) && agencyId !== 0;
	const scope = `${tenantId}|${sessionKey}|${agencyId}`;
	const visit = useRef({ scope, generation: 0 });
	if (visit.current.scope !== scope) {
		visit.current.scope = scope;
		visit.current.generation += 1;
	}
	const generation = visit.current.generation;
	const [answer, setAnswer] = useState<{
		generation: number;
		agency: AgencyDataInterface | null;
		state: 'ready' | 'unavailable';
	} | null>(null);
	useEffect(() => {
		if (!hasAgencyId) return;
		let active = true;
		apiGetAgenciesByIds([agencyId])
			.then((agencies) => {
				if (!active || visit.current.generation !== generation) return;
				const matches = agencies.filter(
					(candidate) => candidate.id === agencyId
				);
				const agency = matches.length === 1 ? matches[0] : undefined;
				// The authorized session's stored agency id is the lookup authority.
				// Cross-Träger participants are supported; no ownerTenantId is in
				// the session DTO. The actor's tenant only scopes async lifetime.
				if (!agency) {
					setAnswer({
						generation,
						agency: null,
						state: 'unavailable'
					});
					return;
				}
				setAnswer({ generation, agency, state: 'ready' });
			})
			.catch(() => {
				if (active && visit.current.generation === generation) {
					setAnswer({
						generation,
						agency: null,
						state: 'unavailable'
					});
				}
			});
		return () => {
			active = false;
		};
	}, [agencyId, tenantId, generation, hasAgencyId]);

	return useMemo(() => {
		if (!hasAgencyId) {
			const policy: AgencyConversationPolicy = {
				agencyId: null,
				tenantId,
				state: 'unavailable'
			};
			return { agency: null, policy };
		}
		const current = answer?.generation === generation ? answer : null;
		const policy: AgencyConversationPolicy = {
			agencyId,
			tenantId,
			state: current?.state ?? 'loading',
			settings: current?.agency?.settings
		};
		return { agency: current?.agency ?? null, policy };
	}, [agencyId, tenantId, generation, answer, hasAgencyId]);
};
