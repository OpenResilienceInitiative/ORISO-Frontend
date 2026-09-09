import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import clsx from 'clsx';
import { FETCH_ERRORS } from '../../api/fetchData';
import {
	apiAcceptCaseHandoverOffer,
	apiDeclineCaseHandoverOffer,
	apiGetCaseHandoverOffers,
	apiWithdrawCaseHandoverOffer,
	CaseHandoverOffer,
	CaseHandoverStatus
} from '../../api/apiCaseHandover';
import { caseHandoverReasonLabel } from './caseHandoverReasons';
import './caseHandoverOffers.styles.scss';

/**
 * The receiving end of "Fall abgeben" (PLAN 2.3).
 *
 * B sees the offers made to her as a badge on the session list plus a list she
 * can accept or decline from. A sees, on the case she offered, that an offer is
 * still open and can withdraw it. Accepting does not by itself mean access:
 * a reason whose policy requires the client's consent lands in
 * `PENDING_CLIENT_CONSENT`, and the list says so rather than pretending the
 * case has moved.
 */

const OPEN_OFFER_STATUSES = new Set([
	'PENDING_RECIPIENT_ACCEPT',
	'PENDING',
	'PENDING_CLIENT_CONSENT'
]);

export const isOpenCaseHandoverOffer = (offer: CaseHandoverOffer): boolean =>
	OPEN_OFFER_STATUSES.has(String(offer.status));

/**
 * Accept, decline and withdraw all answer 409 when the offer is no longer open
 * (someone was faster, or it expired), 403 when the offer is not mine and 404
 * when it is gone. Those are different situations for the counsellor, so they
 * get different sentences instead of one "action failed".
 */
export const offerActionErrorMessage = (
	translate: TFunction,
	errorCode?: string
): string => {
	switch (errorCode) {
		case FETCH_ERRORS.CONFLICT:
			return translate('caseHandover.offers.error.conflict');
		case FETCH_ERRORS.FORBIDDEN:
			return translate('caseHandover.offers.error.forbidden');
		case FETCH_ERRORS.NO_MATCH:
			return translate('caseHandover.offers.error.notFound');
		default:
			return translate('caseHandover.offers.error.actionFailed');
	}
};

/** The server distinguishes shared access from an ownership transfer. */
export const offerAcceptanceNotice = (
	translate: TFunction,
	result: CaseHandoverStatus | null
): string => {
	if (result?.status === 'PENDING_CLIENT_CONSENT') {
		return translate('caseHandover.offers.incoming.consentRequested');
	}
	if (result?.status === 'GRANTED') {
		return translate(
			result.accessType === 'CO_ACCESS'
				? 'caseHandover.list.accessGranted'
				: 'caseHandover.offers.incoming.accepted'
		);
	}
	return '';
};

export interface CaseHandoverOffersInboxViewProps {
	offers: CaseHandoverOffer[];
	expanded: boolean;
	onToggle: () => void;
	busyOfferId?: number | null;
	error?: string;
	/** What accepting actually did — granted, or the client is being asked. */
	notice?: string;
	onAccept: (offerId: number) => void;
	onDecline: (offerId: number) => void;
	/** Injectable so stories and tests are not clock-dependent. */
	formatDate?: (isoDate: string) => string;
}

const defaultFormatDate = (isoDate: string) => {
	const parsed = new Date(isoDate);
	return Number.isNaN(parsed.getTime())
		? isoDate
		: parsed.toLocaleDateString();
};

/** Presentational inbox — stories and tests render this directly. */
export const CaseHandoverOffersInboxView = ({
	offers,
	expanded,
	onToggle,
	busyOfferId = null,
	error,
	notice,
	onAccept,
	onDecline,
	formatDate = defaultFormatDate
}: CaseHandoverOffersInboxViewProps) => {
	const { t: translate } = useTranslation();

	if (offers.length === 0 && !error && !notice) {
		return null;
	}

	return (
		<section
			className="caseHandoverOffers"
			aria-label={translate('caseHandover.offers.incoming.title')}
			data-cy="case-handover-offers"
		>
			<button
				type="button"
				className="caseHandoverOffers__header"
				onClick={onToggle}
				aria-expanded={expanded}
				data-cy="case-handover-offers-toggle"
				data-testid="case-handover-offers-toggle"
			>
				<span className="caseHandoverOffers__title">
					{translate('caseHandover.offers.incoming.title')}
				</span>
				{offers.length > 0 && (
					<CaseHandoverOfferBadge count={offers.length} />
				)}
			</button>

			{error && (
				<p className="caseHandoverOffers__error" role="alert">
					{error}
				</p>
			)}

			{notice && (
				<p
					className="caseHandoverOffers__notice"
					role="status"
					data-cy="case-handover-offers-notice"
					data-testid="case-handover-offers-notice"
				>
					{notice}
				</p>
			)}

			{expanded && offers.length === 0 && !error && (
				<p className="caseHandoverOffers__empty">
					{translate('caseHandover.offers.incoming.empty')}
				</p>
			)}

			{expanded && offers.length > 0 && (
				<ul className="caseHandoverOffers__list">
					{offers.map((offer) => {
						const busy = busyOfferId === offer.offerId;
						const consentPending =
							String(offer.status) === 'PENDING_CLIENT_CONSENT';
						return (
							<li
								className="caseHandoverOffers__item"
								key={offer.offerId}
								data-cy={`case-handover-offer-${offer.offerId}`}
								data-testid={`case-handover-offer-${offer.offerId}`}
							>
								<span className="caseHandoverOffers__itemTitle">
									{translate(
										'caseHandover.offers.incoming.from',
										{
											colleague:
												offer.fromConsultantName ?? ''
										}
									)}
								</span>
								<span className="caseHandoverOffers__itemMeta">
									{caseHandoverReasonLabel(
										translate,
										offer.reasonCode,
										offer.reasonLabel
									)}
								</span>
								{offer.offerExpiresAt && (
									<span className="caseHandoverOffers__itemMeta">
										{translate(
											'caseHandover.offers.incoming.expires',
											{
												date: formatDate(
													offer.offerExpiresAt
												)
											}
										)}
									</span>
								)}
								{consentPending ? (
									<span className="caseHandoverOffers__itemMeta">
										{translate(
											'caseHandover.offers.incoming.consentPending'
										)}
									</span>
								) : (
									<div className="caseHandoverOffers__actions">
										<button
											type="button"
											className={clsx(
												'caseHandoverOffers__action',
												'caseHandoverOffers__action--primary'
											)}
											onClick={() =>
												onAccept(offer.offerId)
											}
											disabled={busy}
											data-cy={`case-handover-offer-accept-${offer.offerId}`}
											data-testid={`case-handover-offer-accept-${offer.offerId}`}
										>
											{translate(
												'caseHandover.offers.incoming.accept'
											)}
										</button>
										<button
											type="button"
											className="caseHandoverOffers__action"
											onClick={() =>
												onDecline(offer.offerId)
											}
											disabled={busy}
											data-cy={`case-handover-offer-decline-${offer.offerId}`}
											data-testid={`case-handover-offer-decline-${offer.offerId}`}
										>
											{translate(
												'caseHandover.offers.incoming.decline'
											)}
										</button>
									</div>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
};

export const CaseHandoverOfferBadge = ({ count }: { count: number }) => {
	const { t: translate } = useTranslation();
	if (count <= 0) {
		return null;
	}
	return (
		<span
			className="caseHandoverOffers__badge"
			data-cy="case-handover-offer-badge"
			data-testid="case-handover-offer-badge"
			aria-label={translate('caseHandover.offers.incoming.badge', {
				count
			})}
		>
			{count}
		</span>
	);
};

interface CaseHandoverOffersInboxProps {
	/** Poll interval in ms; 0 disables polling (stories, tests). */
	pollIntervalMs?: number;
	onOfferResolved?: () => void;
}

/** Container: loads the incoming offers, accepts and declines them. */
export const CaseHandoverOffersInbox = ({
	pollIntervalMs = 60000,
	onOfferResolved
}: CaseHandoverOffersInboxProps) => {
	const { t: translate } = useTranslation();
	const [offers, setOffers] = useState<CaseHandoverOffer[]>([]);
	const [expanded, setExpanded] = useState(true);
	const [busyOfferId, setBusyOfferId] = useState<number | null>(null);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');

	const load = useCallback(
		(signal?: AbortSignal) =>
			apiGetCaseHandoverOffers({ box: 'incoming', signal })
				.then((items) => {
					setOffers((items || []).filter(isOpenCaseHandoverOffer));
					setError('');
				})
				.catch(() => {
					if (signal?.aborted) {
						return;
					}
					// A tenant without the push endpoints must not paint an
					// error bar over the session list, so an empty list wins.
					setOffers([]);
				}),
		[]
	);

	useEffect(() => {
		const controller = new AbortController();
		load(controller.signal);
		if (!pollIntervalMs) {
			return () => controller.abort();
		}
		const intervalId = window.setInterval(() => load(), pollIntervalMs);
		return () => {
			controller.abort();
			window.clearInterval(intervalId);
		};
	}, [load, pollIntervalMs]);

	const resolve = useCallback(
		(offerId: number, action: (id: number) => Promise<unknown>) => {
			setBusyOfferId(offerId);
			setError('');
			return action(offerId)
				.then((result) => {
					onOfferResolved?.();
					return load().then(() => result);
				})
				.catch((requestError) => {
					setError(
						offerActionErrorMessage(
							translate,
							requestError?.message
						)
					);
					return null;
				})
				.finally(() => setBusyOfferId(null));
		},
		[load, onOfferResolved, translate]
	);

	return (
		<CaseHandoverOffersInboxView
			offers={offers}
			expanded={expanded}
			onToggle={() => setExpanded((value) => !value)}
			busyOfferId={busyOfferId}
			error={error}
			notice={notice}
			onAccept={(offerId) => {
				setNotice('');
				resolve(offerId, apiAcceptCaseHandoverOffer).then((result) => {
					setNotice(
						offerAcceptanceNotice(
							translate,
							result as CaseHandoverStatus | null
						)
					);
				});
			}}
			onDecline={(offerId) => {
				setNotice('');
				resolve(offerId, apiDeclineCaseHandoverOffer);
			}}
		/>
	);
};

export interface CaseHandoverOutgoingOfferViewProps {
	offer: CaseHandoverOffer;
	isWithdrawing?: boolean;
	error?: string;
	onWithdraw: () => void;
}

/** "Angebot offen … zurückziehen" on the offering counsellor's own case. */
export const CaseHandoverOutgoingOfferView = ({
	offer,
	isWithdrawing = false,
	error,
	onWithdraw
}: CaseHandoverOutgoingOfferViewProps) => {
	const { t: translate } = useTranslation();
	return (
		<div
			className="caseHandoverOutgoingOffer"
			data-cy="case-handover-outgoing-offer"
		>
			<span className="caseHandoverOutgoingOffer__text">
				{translate('caseHandover.offers.outgoing.pending', {
					colleague: offer.targetConsultantName ?? ''
				})}
				{error ? ` — ${error}` : ''}
			</span>
			<button
				type="button"
				className="caseHandoverOffers__action"
				onClick={onWithdraw}
				disabled={isWithdrawing}
				data-cy="case-handover-offer-withdraw"
				data-testid="case-handover-offer-withdraw"
			>
				{translate('caseHandover.offers.outgoing.withdraw')}
			</button>
		</div>
	);
};

interface CaseHandoverOutgoingOfferProps {
	sessionId: number;
	onWithdrawn?: () => void;
}

/** Container: shows this session's own open offer, withdraws it. */
export const CaseHandoverOutgoingOffer = ({
	sessionId,
	onWithdrawn
}: CaseHandoverOutgoingOfferProps) => {
	const { t: translate } = useTranslation();
	const [offer, setOffer] = useState<CaseHandoverOffer | null>(null);
	const [isWithdrawing, setIsWithdrawing] = useState(false);
	const [error, setError] = useState('');

	const load = useCallback(
		(signal?: AbortSignal) =>
			apiGetCaseHandoverOffers({ box: 'outgoing', signal })
				.then((items) => {
					setOffer(
						(items || []).find(
							(item) =>
								item.sessionId === sessionId &&
								isOpenCaseHandoverOffer(item)
						) ?? null
					);
				})
				.catch(() => {
					if (!signal?.aborted) {
						setOffer(null);
					}
				}),
		[sessionId]
	);

	useEffect(() => {
		const controller = new AbortController();
		load(controller.signal);
		return () => controller.abort();
	}, [load]);

	if (!offer) {
		return null;
	}

	return (
		<CaseHandoverOutgoingOfferView
			offer={offer}
			isWithdrawing={isWithdrawing}
			error={error}
			onWithdraw={() => {
				setIsWithdrawing(true);
				setError('');
				apiWithdrawCaseHandoverOffer(offer.offerId)
					.then(() => {
						setOffer(null);
						onWithdrawn?.();
					})
					.catch((requestError) =>
						setError(
							offerActionErrorMessage(
								translate,
								requestError?.message
							)
						)
					)
					.finally(() => setIsWithdrawing(false));
			}}
		/>
	);
};
