import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGetCaseHandoverStatus, CaseHandoverStatus } from '../../api';

const CASE_HANDOVER_RESOLUTION_EVENTS = new Set([
	'case.handover.granted',
	'case.handover.consent.declined'
]);

type CaseHandoverNotification = {
	id: string;
	eventType: string;
	sourceSessionId?: string | number;
};

type UseCaseHandoverStatusRefreshOptions = {
	enabled: boolean;
	sessionId?: number;
	notifications?: CaseHandoverNotification[];
	onStatus: (status: CaseHandoverStatus) => void;
};

export const useCaseHandoverStatusRefresh = ({
	enabled,
	sessionId,
	notifications,
	onStatus
}: UseCaseHandoverStatusRefreshOptions) => {
	const generationRef = useRef(0);
	const requestSequenceRef = useRef(0);
	const attemptedEventIdsRef = useRef(new Set<string>());
	const failedEventIdsRef = useRef(new Set<string>());
	const handledEventIdsRef = useRef(new Set<string>());
	const [focusRetry, setFocusRetry] = useState(0);
	const invalidateUnfinishedAttempts = useCallback(() => {
		requestSequenceRef.current += 1;
		attemptedEventIdsRef.current = new Set(handledEventIdsRef.current);
		failedEventIdsRef.current.clear();
	}, []);

	useEffect(() => {
		generationRef.current += 1;
		invalidateUnfinishedAttempts();
		return () => {
			generationRef.current += 1;
			invalidateUnfinishedAttempts();
		};
	}, [invalidateUnfinishedAttempts, sessionId]);

	useEffect(() => {
		if (enabled) {
			return;
		}
		invalidateUnfinishedAttempts();
	}, [enabled, invalidateUnfinishedAttempts]);

	useEffect(() => {
		if (!enabled || sessionId === undefined || sessionId === null) {
			return;
		}

		const notification = notifications?.find(
			(item) =>
				CASE_HANDOVER_RESOLUTION_EVENTS.has(item.eventType) &&
				String(item.sourceSessionId) === String(sessionId) &&
				!handledEventIdsRef.current.has(item.id) &&
				!attemptedEventIdsRef.current.has(item.id)
		);
		if (!notification) {
			return;
		}

		const eventId = notification.id;
		const requestGeneration = generationRef.current;
		const requestSequence = requestSequenceRef.current + 1;
		requestSequenceRef.current = requestSequence;
		attemptedEventIdsRef.current.add(eventId);

		apiGetCaseHandoverStatus(sessionId)
			.then((status) => {
				if (
					requestGeneration !== generationRef.current ||
					requestSequence !== requestSequenceRef.current
				) {
					return;
				}
				if (String(status.sessionId) !== String(sessionId)) {
					failedEventIdsRef.current.add(eventId);
					return;
				}
				handledEventIdsRef.current.add(eventId);
				failedEventIdsRef.current.delete(eventId);
				onStatus(status);
			})
			.catch(() => {
				if (
					requestGeneration === generationRef.current &&
					requestSequence === requestSequenceRef.current
				) {
					failedEventIdsRef.current.add(eventId);
				}
			});
	}, [enabled, focusRetry, notifications, onStatus, sessionId]);

	useEffect(() => {
		if (!enabled || sessionId === undefined || sessionId === null) {
			return;
		}

		const retryOnFocus = () => {
			const failedNotification = notifications?.find(
				(item) =>
					CASE_HANDOVER_RESOLUTION_EVENTS.has(item.eventType) &&
					String(item.sourceSessionId) === String(sessionId) &&
					failedEventIdsRef.current.has(item.id)
			);
			if (!failedNotification) {
				return;
			}
			failedEventIdsRef.current.delete(failedNotification.id);
			attemptedEventIdsRef.current.delete(failedNotification.id);
			setFocusRetry((retry) => retry + 1);
		};

		window.addEventListener('focus', retryOnFocus);
		return () => window.removeEventListener('focus', retryOnFocus);
	}, [enabled, notifications, sessionId]);
};
