import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { BUTTON_TYPES, Button } from '../button/Button';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import {
	SupervisorDialog,
	SupervisorDialogCopy
} from '../supervisorDialog/SupervisorDialog';
import { ReactComponent as HandoverIcon } from '../../resources/img/icons/case_handover_200_24px.svg';
import { caseHandoverReasonOptionLabel } from './caseHandoverReasons';
import {
	CaseHandoverOfferState,
	isGrantedCaseHandoverStatus,
	isOfferableReason,
	isWithdrawableOfferStatus
} from './useCaseHandoverOffer';

interface CaseHandoverOfferProps {
	handover: CaseHandoverOfferState;
	/**
	 * `inline` (profile): status, retry and withdraw sit under the profile
	 * button. `dialog` (chat-room menu, FE#2250): the menu has no room for
	 * them, so a pending offer or a load error opens in a small dialog.
	 */
	presentation?: 'inline' | 'dialog';
}

/**
 * Everything after the "Beratung übergeben" trigger: the offer dialog, the
 * pending state and its withdraw button. The trigger itself stays with the
 * caller (profile button or chat-room menu item).
 */
export const CaseHandoverOffer = ({
	handover,
	presentation = 'inline'
}: CaseHandoverOfferProps) => {
	const { t: translate } = useTranslation();
	const {
		open,
		loading,
		busy,
		error,
		status,
		offerStatus,
		candidates,
		reasons,
		selectedId,
		reasonCode,
		setSelectedId,
		setReasonCode,
		handleClose,
		loadForm,
		submitOffer,
		withdrawOffer
	} = handover;

	const copy = buildDialogCopy(translate);
	const showOfferDialog = open && !loading && Boolean(status) && !offerStatus;
	const showRetry = open && Boolean(error) && !loading && !status;
	const showWithdraw =
		open &&
		Boolean(offerStatus?.requestId) &&
		isWithdrawableOfferStatus(offerStatus.status);

	const errorLine = error && !showOfferDialog && <p role="alert">{error}</p>;
	const statusLine = open && offerStatus && (
		<p role="status">
			{translate(
				`caseHandover.offer.status.${
					isGrantedCaseHandoverStatus(offerStatus.status)
						? 'GRANTED'
						: offerStatus.status
				}`
			)}
		</p>
	);
	const offerDialog = showOfferDialog && (
		<SupervisorDialog
			mode="handover"
			copy={copy}
			candidates={candidates}
			reasons={reasons.filter(isOfferableReason).map((reason) => ({
				code: reason.code,
				label: caseHandoverReasonOptionLabel(translate, reason)
			}))}
			selectedId={selectedId}
			reason={reasonCode}
			busy={busy}
			error={error}
			onSelect={setSelectedId}
			onReasonChange={setReasonCode}
			onConfirm={() => void submitOffer()}
			onClose={handleClose}
		/>
	);

	if (presentation === 'dialog') {
		// The menu closes before the form loads: show progress and a close
		// control instead of nothing until the requests answer.
		const showStateDialog =
			open &&
			!showOfferDialog &&
			(loading || Boolean(offerStatus) || showRetry);
		return (
			<>
				{offerDialog}
				{showStateDialog && (
					<M3Dialog
						title={copy.title.handover}
						icon={
							<HandoverIcon
								aria-hidden="true"
								focusable="false"
							/>
						}
						onClose={handleClose}
						closeLabel={copy.close}
						data-testid="case-handover-state-dialog"
						actions={[
							...(showWithdraw
								? [
										{
											label: translate(
												'caseHandover.offer.withdraw'
											),
											onClick: () => void withdrawOffer(),
											disabled: busy,
											busy
										}
									]
								: []),
							...(showRetry
								? [
										{
											label: translate(
												'caseHandover.offer.retry'
											),
											onClick: () => void loadForm()
										}
									]
								: []),
							{
								label: copy.close,
								onClick: handleClose,
								primary: true
							}
						]}
					>
						{errorLine}
						{statusLine}
						{loading && !offerStatus && (
							<p role="status">
								{translate('caseHandover.offer.loading')}
							</p>
						)}
					</M3Dialog>
				)}
			</>
		);
	}

	return (
		<>
			{errorLine}
			{showRetry && (
				<Button
					item={{
						label: 'caseHandover.offer.retry',
						type: BUTTON_TYPES.PRIMARY
					}}
					buttonHandle={() => void loadForm()}
				/>
			)}
			{offerDialog}
			{statusLine}
			{showWithdraw && (
				<Button
					item={{
						label: 'caseHandover.offer.withdraw',
						type: BUTTON_TYPES.SECONDARY
					}}
					buttonHandle={() => void withdrawOffer()}
					disabled={busy}
				/>
			)}
		</>
	);
};

const buildDialogCopy = (
	translate: (key: string) => string
): SupervisorDialogCopy => ({
	title: {
		add: translate('supervisorDialog.title.add'),
		change: translate('supervisorDialog.title.change'),
		handover: translate('supervisorDialog.title.handover')
	},
	description: {
		add: translate('supervisorDialog.description.add'),
		change: translate('supervisorDialog.description.change'),
		handover: translate('supervisorDialog.description.handover')
	},
	currentHeading: translate('supervisorDialog.currentHeading'),
	noneYet: translate('supervisorDialog.noneYet'),
	personLabel: {
		add: translate('supervisorDialog.personLabel.add'),
		change: translate('supervisorDialog.personLabel.change'),
		handover: translate('supervisorDialog.personLabel.handover')
	},
	reasonLabel: {
		add: translate('supervisorDialog.reasonLabel.add'),
		change: translate('supervisorDialog.reasonLabel.change'),
		handover: translate('supervisorDialog.reasonLabel.handover')
	},
	reasonPlaceholder: translate('supervisorDialog.reasonPlaceholder'),
	reasonError: translate('supervisorDialog.reasonError'),
	reasonEmptyOption: translate('supervisorDialog.reasonEmptyOption'),
	explanation: {
		add: translate('supervisorDialog.explanation.add'),
		change: translate('supervisorDialog.explanation.change'),
		handover: translate('supervisorDialog.explanation.handover')
	},
	handoverPending: translate('supervisorDialog.handoverPending'),
	confirm: {
		add: translate('supervisorDialog.confirm.add'),
		change: translate('supervisorDialog.confirm.change'),
		handover: translate('supervisorDialog.confirm.handover')
	},
	cancel: translate('supervisorDialog.cancel'),
	close: translate('supervisorDialog.close'),
	emptyOption: translate('supervisorDialog.emptyOption')
});
