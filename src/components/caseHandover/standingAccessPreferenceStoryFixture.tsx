import * as React from 'react';
import { endpoints } from '../../resources/scripts/endpoints';

/** Only the scoped HTTP preference transport is synthetic. Message, dialog,
 * switch and save/readback continuation stay production components. */
export const StandingAccessPreferenceStoryFixture = ({
	sessionId,
	children
}: {
	sessionId: number;
	children: React.ReactNode;
}) => {
	const saved = React.useRef(false);
	const [ready, setReady] = React.useState(false);
	React.useEffect(() => {
		const previous = globalThis.fetch;
		const path = `${endpoints.sessionBase}/${sessionId}/case-handover/consent-preference`;
		globalThis.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.href
						: input.url;
			if (url.endsWith(path)) {
				const method =
					init?.method ??
					(input instanceof Request ? input.method : 'GET');
				if (method === 'PUT') {
					const body =
						init?.body ??
						(input instanceof Request
							? await input.clone().text()
							: '');
					saved.current = JSON.parse(
						String(body)
					).alwaysAskBeforeAdditionalAccess;
				}
				return new Response(
					JSON.stringify({
						sessionId,
						alwaysAskBeforeAdditionalAccess: saved.current
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}
			return previous(input, init);
		};
		setReady(true);
		return () => {
			globalThis.fetch = previous;
		};
	}, [sessionId]);
	return ready ? <>{children}</> : null;
};
