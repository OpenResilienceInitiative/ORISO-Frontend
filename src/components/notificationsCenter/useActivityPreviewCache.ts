import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import type { MatrixActivityPreviewKind } from '../../utils/matrixActivityPreview';

type Source = {
	activityEventId: string;
	roomRef: string;
	matrixEventId: string;
};
type HydratedActivityPreview = {
	text: string;
	kind: MatrixActivityPreviewKind;
};

export const useActivityPreviewCache = (
	sources: readonly Source[],
	viewerId: string | undefined,
	viewerName: string | undefined
) => {
	const matrixService = useContext(MatrixClientContext)?.matrixClientService;
	const [, setClientRevision] = useState(0);
	useEffect(
		() =>
			matrixService?.onClientChange(() =>
				setClientRevision((n) => n + 1)
			),
		[matrixService]
	);
	const client = matrixService?.getClient();
	const [hydratedMessagePreviews, setHydratedMessagePreviews] = useState<
		Record<
			string,
			HydratedActivityPreview & {
				fingerprint: string;
				token: object;
				client: typeof client;
				service: typeof matrixService;
			}
		>
	>({});
	// A card ID is not a source identity: the same ID can be reused with a
	// different Matrix event, room, viewer or client while this hook stays mounted.
	const fingerprints = useMemo(() => {
		const result = new Map<string, string>();
		sources.forEach((source) =>
			result.set(
				source.activityEventId,
				JSON.stringify([
					source.roomRef,
					source.matrixEventId,
					viewerId,
					viewerName
				])
			)
		);
		return result;
	}, [sources, viewerId, viewerName]);
	const current = useRef({
		fingerprints: new Map<string, string>(),
		tokens: new Map<string, object>(),
		client,
		matrixService
	});
	const tokens = useMemo(() => {
		const next = new Map<string, object>();
		fingerprints.forEach((fingerprint, id) => {
			const unchanged =
				current.current.fingerprints.get(id) === fingerprint &&
				current.current.client === client &&
				current.current.matrixService === matrixService;
			next.set(id, unchanged ? current.current.tokens.get(id) || {} : {});
		});
		return next;
	}, [fingerprints, client, matrixService]);
	current.current = { fingerprints, tokens, client, matrixService };

	useEffect(() => {
		setHydratedMessagePreviews((previous) => {
			const next = Object.fromEntries(
				Object.entries(previous).filter(
					([id, entry]) =>
						fingerprints.get(id) === entry.fingerprint &&
						current.current.tokens.get(id) === entry.token &&
						entry.client === client &&
						entry.service === matrixService
				)
			);
			return Object.keys(next).length === Object.keys(previous).length
				? previous
				: next;
		});
	}, [fingerprints, client, matrixService]);

	const visiblePreview = useCallback(
		(activityEventId: string) => {
			const entry = hydratedMessagePreviews[activityEventId];
			return entry &&
				fingerprints.get(activityEventId) === entry.fingerprint &&
				current.current.tokens.get(activityEventId) === entry.token &&
				entry.client === client &&
				entry.service === matrixService &&
				matrixService?.getClient() === client
				? { text: entry.text, kind: entry.kind }
				: undefined;
		},
		[hydratedMessagePreviews, fingerprints, client, matrixService]
	);

	const onPreviewChange = useCallback(
		(
			activityEventId: string,
			preview: string,
			kind: MatrixActivityPreviewKind
		) => {
			const fingerprint = fingerprints.get(activityEventId);
			const token = tokens.get(activityEventId);
			if (
				!token ||
				current.current.tokens.get(activityEventId) !== token ||
				!fingerprint ||
				current.current.fingerprints.get(activityEventId) !==
					fingerprint ||
				current.current.client !== client ||
				current.current.matrixService !== matrixService ||
				matrixService?.getClient() !== client
			)
				return;
			setHydratedMessagePreviews((previous) => {
				const entry = previous[activityEventId];
				if (
					entry?.token === token &&
					entry.text === preview &&
					entry.kind === kind
				)
					return previous;
				return {
					...previous,
					[activityEventId]: {
						text: preview,
						kind,
						fingerprint,
						token,
						client,
						service: matrixService
					}
				};
			});
		},
		[fingerprints, tokens, client, matrixService]
	);

	return { onPreviewChange, visiblePreview };
};
