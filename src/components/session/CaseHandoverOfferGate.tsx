import * as React from 'react';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	apiDecideCaseHandoverRecipient,
	apiGetCaseHandoverRequestStatus,
	CaseHandoverStatus
} from '../../api/apiCaseHandover';
import { FETCH_ERRORS } from '../../api/fetchData';
import { useCaseHandoverResolutionEvents } from '../caseHandover/useCaseHandoverResolutionEvents';
import { Loading } from '../app/Loading';
import { M3Dialog } from '../m3Dialog/M3Dialog';

interface CaseHandoverOfferGateProps {
	actorId: string;
	sessionId: number;
	requestId: number;
	onClose: () => void;
	children: ReactNode;
}

type OfferError = 'forbidden' | 'notFound' | 'generic';

interface ScopedOffer {
	identity: string;
	status: CaseHandoverStatus;
}

const asOfferError = (error: unknown): OfferError => {
	if (error instanceof Error && error.message === FETCH_ERRORS.FORBIDDEN) {
		return 'forbidden';
	}
	if (error instanceof Error && error.message === FETCH_ERRORS.NO_MATCH) {
		return 'notFound';
	}
	return 'generic';
};

export const CaseHandoverOfferGate = ({
	actorId,
	sessionId,
	requestId,
	onClose,
	children
}: CaseHandoverOfferGateProps) => {
	const { t } = useTranslation();
	const identity = `${actorId}:${sessionId}:${requestId}`;
	const [scopedOffer, setScopedOffer] = useState<ScopedOffer>();
	const [error, setError] = useState<OfferError>();
	const [loading, setLoading] = useState(true);
	const [deciding, setDeciding] = useState(false);
	const generationRef = useRef(0);
	const loadSequenceRef = useRef(0);
	const decisionSequenceRef = useRef(0);
	const decidingRef = useRef(false);
	const offer =
		scopedOffer?.identity === identity ? scopedOffer.status : undefined;

	const loadOffer = useCallback(async () => {
		const generation = generationRef.current;
		const sequence = ++loadSequenceRef.current;
		setLoading(true);
		try {
			const response = await apiGetCaseHandoverRequestStatus(
				sessionId,
				requestId
			);
			if (
				response.sessionId !== sessionId ||
				response.requestId !== requestId
			) {
				throw new Error(FETCH_ERRORS.NO_MATCH);
			}
			if (
				generation === generationRef.current &&
				sequence === loadSequenceRef.current
			) {
				setScopedOffer({ identity, status: response });
				setError(undefined);
			}
		} catch (loadError) {
			if (
				generation === generationRef.current &&
				sequence === loadSequenceRef.current
			) {
				setScopedOffer(undefined);
				setError(asOfferError(loadError));
			}
		} finally {
			if (
				generation === generationRef.current &&
				sequence === loadSequenceRef.current
			) {
				setLoading(false);
			}
		}
	}, [identity, requestId, sessionId]);

	useEffect(() => {
		generationRef.current += 1;
		loadSequenceRef.current = 0;
		decisionSequenceRef.current = 0;
		decidingRef.current = false;
		setScopedOffer(undefined);
		setError(undefined);
		setDeciding(false);
		void loadOffer();

		const refreshOnFocus = () => {
			if (!decidingRef.current) void loadOffer();
		};
		window.addEventListener('focus', refreshOnFocus);
		return () => {
			generationRef.current += 1;
			window.removeEventListener('focus', refreshOnFocus);
		};
	}, [loadOffer]);

	const handleResolutionEvent = useCallback(
		() => void loadOffer(),
		[loadOffer]
	);
	useCaseHandoverResolutionEvents({
		actorId,
		sessionId,
		requestId,
		enabled: Boolean(offer),
		pausedRef: decidingRef,
		onResolution: handleResolutionEvent
	});

	const decide = async (approved: boolean) => {
		const generation = generationRef.current;
		const sequence = ++decisionSequenceRef.current;
		loadSequenceRef.current += 1;
		decidingRef.current = true;
		setDeciding(true);
		try {
			const response = await apiDecideCaseHandoverRecipient(
				sessionId,
				requestId,
				approved
			);
			if (
				response.sessionId !== sessionId ||
				response.requestId !== requestId
			) {
				throw new Error(FETCH_ERRORS.NO_MATCH);
			}
			if (
				generation === generationRef.current &&
				sequence === decisionSequenceRef.current
			) {
				setScopedOffer({ identity, status: response });
				setError(undefined);
			}
		} catch (decisionError) {
			if (
				generation === generationRef.current &&
				sequence === decisionSequenceRef.current
			) {
				setError(asOfferError(decisionError));
			}
		} finally {
			if (
				generation === generationRef.current &&
				sequence === decisionSequenceRef.current
			) {
				decidingRef.current = false;
				setDeciding(false);
				setLoading(false);
			}
		}
	};

	if (offer?.status === 'GRANTED' && offer.canViewContent) {
		return <>{children}</>;
	}

	if (loading && !offer && !error) {
		return <Loading />;
	}

	let messageKey = 'caseHandover.offer.pending';
	if (error) {
		messageKey = `caseHandover.offer.${error}`;
	} else if (offer?.status === 'RECIPIENT_DECLINED') {
		messageKey = 'caseHandover.offer.declined';
	} else if (offer?.status === 'PENDING_CLIENT_CONSENT') {
		messageKey = 'caseHandover.offer.awaitingClientConsent';
	} else if (offer?.status === 'DENIED') {
		messageKey = 'caseHandover.offer.denied';
	} else if (offer?.status === 'CLIENT_CONSENT_DECLINED') {
		messageKey = 'caseHandover.offer.clientConsentDeclined';
	} else if (offer?.status === 'GRANTED' && !offer.canViewContent) {
		messageKey = 'caseHandover.offer.noContent';
	}

	const canDecide =
		!error && offer?.status === 'PENDING_RECIPIENT_ACCEPTANCE';

	return (
		<M3Dialog
			title={t('caseHandover.offer.title')}
			onClose={onClose}
			closeLabel={t('app.close')}
			severity={error ? 'error' : 'info'}
			actions={
				canDecide
					? [
							{
								label: t('caseHandover.offer.decline'),
								onClick: () => void decide(false),
								disabled: deciding,
								testId: 'case-handover-offer-decline'
							},
							{
								label: t('caseHandover.offer.accept'),
								onClick: () => void decide(true),
								primary: true,
								disabled: deciding,
								testId: 'case-handover-offer-accept'
							}
						]
					: error
						? [
								{
									label: t('caseHandover.offer.retry'),
									onClick: () => void loadOffer(),
									primary: true,
									testId: 'case-handover-offer-retry'
								}
							]
						: []
			}
		>
			<p>{t(messageKey)}</p>
		</M3Dialog>
	);
};
