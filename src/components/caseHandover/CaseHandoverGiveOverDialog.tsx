import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import clsx from 'clsx';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { FETCH_ERRORS } from '../../api/fetchData';
import {
	apiCreateCaseHandoverOffer,
	apiGetCaseHandoverColleagues,
	apiGetCaseHandoverReasons,
	caseHandoverColleagueName,
	CaseHandoverColleague,
	CaseHandoverOffer,
	CaseHandoverReason
} from '../../api/apiCaseHandover';
import { caseHandoverReasonLabelOf } from './caseHandoverReasons';
import { ReactComponent as CaseHandoverIcon } from '../../resources/img/icons/case-handover/case-handover.svg';
import './caseHandoverGiveOver.styles.scss';

/**
 * "Fall abgeben" — the push direction of the case handover (PLAN E3/E5/E8).
 *
 * The counsellor who owns the case names a colleague of the same counselling
 * centre and a reason. The colleague has to accept; only then does the usual
 * grant path run, which is where the client's consent is asked for if the
 * reason's policy demands it. That is deliberately NOT a third consent gate
 * (ADR-022) — this dialog only *says* whether the client will be asked, it
 * never asks her itself.
 */

/**
 * The contract answers a failed offer with 409 (this case already has an open
 * offer), 403 (not my case, or the colleague is not eligible), 404 (no such
 * session or consultant) and 400. Each one gets its own sentence — "failed" for
 * everything would leave the counsellor guessing whether to retry.
 */
export const giveOverErrorMessage = (
	translate: TFunction,
	errorCode?: string
): string => {
	switch (errorCode) {
		case FETCH_ERRORS.CONFLICT:
			return translate('caseHandover.giveOver.error.conflict');
		case FETCH_ERRORS.FORBIDDEN:
			return translate('caseHandover.giveOver.error.forbidden');
		case FETCH_ERRORS.NO_MATCH:
			return translate('caseHandover.giveOver.error.notFound');
		default:
			return translate('caseHandover.giveOver.error.failed');
	}
};

export interface CaseHandoverGiveOverViewProps {
	open?: boolean;
	colleagues: CaseHandoverColleague[];
	colleaguesLoading?: boolean;
	query: string;
	onQueryChange: (value: string) => void;
	selectedColleagueId: string;
	onColleagueSelect: (consultantId: string) => void;
	reasons: CaseHandoverReason[];
	reasonCode: string;
	onReasonSelect: (code: string) => void;
	isSubmitting?: boolean;
	error?: string;
	onSubmit: () => void;
	onClose: () => void;
}

/** Presentational dialog — stories and tests render this directly. */
export const CaseHandoverGiveOverView = ({
	open = true,
	colleagues,
	colleaguesLoading = false,
	query,
	onQueryChange,
	selectedColleagueId,
	onColleagueSelect,
	reasons,
	reasonCode,
	onReasonSelect,
	isSubmitting = false,
	error,
	onSubmit,
	onClose
}: CaseHandoverGiveOverViewProps) => {
	const { t: translate } = useTranslation();

	const selectedReason = useMemo(
		() => reasons.find((reason) => reason.code === reasonCode),
		[reasons, reasonCode]
	);

	const coAccess = selectedReason?.accessType === 'CO_ACCESS';
	const canSubmit =
		Boolean(selectedColleagueId) && Boolean(reasonCode) && !isSubmitting;

	return (
		<M3Dialog
			open={open}
			onClose={onClose}
			width={600}
			icon={<CaseHandoverIcon />}
			title={translate(
				coAccess
					? 'caseHandover.giveOver.coAccessTitle'
					: 'caseHandover.giveOver.title'
			)}
			description={translate(
				coAccess
					? 'caseHandover.giveOver.coAccessDescription'
					: 'caseHandover.giveOver.description'
			)}
			closeLabel={translate('app.close')}
			data-testid="case-handover-give-over-dialog"
			actions={[
				{
					label: translate('caseHandover.giveOver.cancel'),
					onClick: onClose,
					testId: 'case-handover-give-over-cancel'
				},
				{
					label: translate(
						coAccess
							? 'caseHandover.giveOver.coAccessSubmit'
							: 'caseHandover.giveOver.submit'
					),
					onClick: onSubmit,
					primary: true,
					disabled: !canSubmit,
					testId: 'case-handover-give-over-submit'
				}
			]}
		>
			<div className="caseHandoverGiveOver">
				{selectedReason && (
					<p
						className={clsx(
							'caseHandoverGiveOver__hint',
							selectedReason.clientConsentRequired &&
								'caseHandoverGiveOver__hint--consent'
						)}
						data-cy="case-handover-give-over-consent-hint"
					>
						{selectedReason.clientConsentRequired
							? translate(
									coAccess
										? 'caseHandover.curtain.consentPending'
										: 'caseHandover.giveOver.consentHint'
								)
							: translate('caseHandover.giveOver.noConsentHint')}
					</p>
				)}
				<div className="caseHandoverGiveOver__section">
					<p
						className="caseHandoverGiveOver__label"
						id="chgo-colleague"
					>
						{translate('caseHandover.giveOver.colleague.label')}
					</p>
					<input
						type="search"
						className="caseHandoverGiveOver__search"
						value={query}
						onChange={(event) => onQueryChange(event.target.value)}
						placeholder={translate(
							'caseHandover.giveOver.colleague.searchPlaceholder'
						)}
						aria-label={translate(
							'caseHandover.giveOver.colleague.searchPlaceholder'
						)}
						data-cy="case-handover-give-over-search"
					/>
					{colleaguesLoading && (
						<p className="caseHandoverGiveOver__loading">
							{translate(
								'caseHandover.giveOver.colleague.loading'
							)}
						</p>
					)}
					{!colleaguesLoading && colleagues.length === 0 && (
						<p className="caseHandoverGiveOver__empty">
							{translate('caseHandover.giveOver.colleague.empty')}
						</p>
					)}
					{colleagues.length > 0 && (
						<div
							className="caseHandoverGiveOver__list"
							role="radiogroup"
							aria-labelledby="chgo-colleague"
						>
							{colleagues.map((colleague) => {
								const isSelected =
									selectedColleagueId ===
									colleague.consultantId;
								return (
									<button
										type="button"
										key={colleague.consultantId}
										role="radio"
										aria-checked={isSelected}
										className={clsx(
											'caseHandoverGiveOver__option',
											isSelected &&
												'caseHandoverGiveOver__option--selected'
										)}
										onClick={() =>
											onColleagueSelect(
												colleague.consultantId
											)
										}
										data-cy={`case-handover-colleague-${colleague.consultantId}`}
									>
										<span
											className="caseHandoverGiveOver__radio"
											aria-hidden
										/>
										<span className="caseHandoverGiveOver__optionText">
											<span className="caseHandoverGiveOver__optionName">
												{caseHandoverColleagueName(
													colleague
												)}
											</span>
											{colleague.absent && (
												<span className="caseHandoverGiveOver__optionMeta">
													{translate(
														'caseHandover.giveOver.colleague.absent'
													)}
												</span>
											)}
										</span>
									</button>
								);
							})}
						</div>
					)}
				</div>

				<div className="caseHandoverGiveOver__section">
					<p className="caseHandoverGiveOver__label" id="chgo-reason">
						{translate('caseHandover.giveOver.reason.label')}
					</p>
					<div
						className="caseHandoverGiveOver__list"
						role="radiogroup"
						aria-labelledby="chgo-reason"
					>
						{reasons.map((reason) => {
							const isSelected = reasonCode === reason.code;
							return (
								<button
									type="button"
									key={reason.code}
									role="radio"
									aria-checked={isSelected}
									className={clsx(
										'caseHandoverGiveOver__option',
										isSelected &&
											'caseHandoverGiveOver__option--selected'
									)}
									onClick={() => onReasonSelect(reason.code)}
									data-cy={`case-handover-give-over-reason-${reason.code}`}
								>
									<span
										className="caseHandoverGiveOver__radio"
										aria-hidden
									/>
									<span className="caseHandoverGiveOver__optionText">
										<span className="caseHandoverGiveOver__optionName">
											{caseHandoverReasonLabelOf(
												translate,
												reason
											)}
										</span>
									</span>
								</button>
							);
						})}
					</div>
				</div>

				{error && (
					<p className="caseHandoverGiveOver__error" role="alert">
						{error}
					</p>
				)}
			</div>
		</M3Dialog>
	);
};

interface CaseHandoverGiveOverDialogProps {
	sessionId: number;
	open: boolean;
	onClose: () => void;
	onOfferCreated?: (offer: CaseHandoverOffer) => void;
}

/** Container: loads colleagues and reasons, creates the offer. */
export const CaseHandoverGiveOverDialog = ({
	sessionId,
	open,
	onClose,
	onOfferCreated
}: CaseHandoverGiveOverDialogProps) => {
	const { t: translate } = useTranslation();
	const [colleagues, setColleagues] = useState<CaseHandoverColleague[]>([]);
	const [colleaguesLoading, setColleaguesLoading] = useState(false);
	const [query, setQuery] = useState('');
	const [selectedColleagueId, setSelectedColleagueId] = useState('');
	const [reasons, setReasons] = useState<CaseHandoverReason[]>([]);
	const [reasonCode, setReasonCode] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		if (!open) {
			return;
		}
		setSelectedColleagueId('');
		setReasonCode('');
		setQuery('');
		setError('');
	}, [open, sessionId]);

	useEffect(() => {
		if (!open) {
			return;
		}
		apiGetCaseHandoverReasons()
			.then((items) => setReasons(items || []))
			.catch(() => {
				setReasons([]);
				setError(translate('caseHandover.error.failed'));
			});
	}, [open, translate]);

	useEffect(() => {
		if (!open) {
			return;
		}
		const controller = new AbortController();
		setColleaguesLoading(true);
		// Debounced so typing in the search box does not fire a request per
		// keystroke; the abort keeps the last answer the one that wins.
		const timer = window.setTimeout(() => {
			apiGetCaseHandoverColleagues({
				sessionId,
				query,
				signal: controller.signal
			})
				.then((response) => {
					setColleagues(response?.colleagues || []);
					setColleaguesLoading(false);
				})
				.catch((requestError) => {
					if (controller.signal.aborted) {
						return;
					}
					setColleagues([]);
					setColleaguesLoading(false);
					const code = requestError?.message;
					setError(
						code === FETCH_ERRORS.FORBIDDEN ||
							code === FETCH_ERRORS.NO_MATCH
							? giveOverErrorMessage(translate, code)
							: translate('caseHandover.offers.error.failed')
					);
				});
		}, 250);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [open, sessionId, query, translate]);

	const handleSubmit = useCallback(() => {
		if (!selectedColleagueId || !reasonCode || isSubmitting) {
			setError(translate('caseHandover.giveOver.error.required'));
			return;
		}
		setIsSubmitting(true);
		setError('');
		const selectedReason = reasons.find(
			(reason) => reason.code === reasonCode
		);
		apiCreateCaseHandoverOffer({
			sessionId,
			targetConsultantId: selectedColleagueId,
			reasonCode,
			// The contract requires a staff-only explanation and this dialog
			// has no free-text field, so the chosen reason is the note.
			explanation: selectedReason
				? caseHandoverReasonLabelOf(translate, selectedReason)
				: reasonCode
		})
			.then((offer) => {
				onOfferCreated?.(offer);
				onClose();
			})
			.catch((requestError) => {
				setError(
					giveOverErrorMessage(translate, requestError?.message)
				);
			})
			.finally(() => setIsSubmitting(false));
	}, [
		isSubmitting,
		onClose,
		onOfferCreated,
		reasonCode,
		reasons,
		selectedColleagueId,
		sessionId,
		translate
	]);

	if (!open) {
		return null;
	}

	return (
		<CaseHandoverGiveOverView
			open={open}
			colleagues={colleagues}
			colleaguesLoading={colleaguesLoading}
			query={query}
			onQueryChange={setQuery}
			selectedColleagueId={selectedColleagueId}
			onColleagueSelect={setSelectedColleagueId}
			reasons={reasons}
			reasonCode={reasonCode}
			onReasonSelect={setReasonCode}
			isSubmitting={isSubmitting}
			error={error}
			onSubmit={handleSubmit}
			onClose={onClose}
		/>
	);
};
