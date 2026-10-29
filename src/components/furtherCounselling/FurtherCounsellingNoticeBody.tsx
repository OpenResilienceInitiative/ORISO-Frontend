import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { Button, BUTTON_TYPES, ButtonItem } from '../button/Button';
import { NewRequestDialog } from '../profile/NewRequestDialog/NewRequestDialog';
import {
	FURTHER_COUNSELLING_RECOMMENDED,
	FurtherCounsellingNotice,
	TOPIC_DUPLICATE_STARTED
} from './furtherCounsellingNotices';
import {
	hasRequestedFromCard,
	markRequestedFromCard
} from './furtherCounsellingCardState';
import { useFurtherCounsellingPrefill } from './useFurtherCounsellingPrefill';
import { useTopicName } from './useTopicName';
import './furtherCounselling.styles.scss';

export interface FurtherCounsellingNoticeBodyProps {
	notice: FurtherCounsellingNotice;
	/** Only the advice seeker gets "Beratungsstelle finden". */
	viewerIsAsker: boolean;
	/** The room event id; keys the "Anfrage gestellt" state. */
	messageId?: string | null;
}

/**
 * Bubble payload of the FE#1876 notices. `MessageItemComponent` draws the
 * Carimat header and the grey bubble around it, as for every system notice.
 */
export const FurtherCounsellingNoticeBody = ({
	notice,
	viewerIsAsker,
	messageId
}: FurtherCounsellingNoticeBodyProps) => {
	const { t: translate } = useTranslation();
	const topic = useTopicName(notice.topicId);

	if (notice.type !== FURTHER_COUNSELLING_RECOMMENDED) {
		return (
			<p
				className="messageItem__systemNotificationDescription"
				data-cy="topic-duplicate-notice"
			>
				{translate(
					notice.type === TOPIC_DUPLICATE_STARTED
						? 'furtherCounselling.duplicate.started'
						: 'furtherCounselling.duplicate.ended',
					{ topic }
				)}
			</p>
		);
	}

	return (
		<RecommendationBody
			topic={topic}
			topicId={notice.topicId}
			note={notice.note}
			viewerIsAsker={viewerIsAsker}
			messageId={messageId}
		/>
	);
};

const RecommendationBody = ({
	topic,
	topicId,
	note,
	viewerIsAsker,
	messageId
}: {
	topic: string;
	topicId: number;
	note: string | null;
	viewerIsAsker: boolean;
	messageId?: string | null;
}) => {
	const { t: translate } = useTranslation();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [requested, setRequested] = useState(() =>
		hasRequestedFromCard(messageId)
	);

	const findAgencyButton: ButtonItem = {
		label: translate('furtherCounselling.card.findAgency'),
		type: BUTTON_TYPES.SECONDARY
	};

	return (
		<div
			className="furtherCounsellingCard"
			data-cy="further-counselling-card"
		>
			<p className="furtherCounsellingCard__topic">
				{translate('furtherCounselling.card.topic', { topic })}
			</p>
			<p className="messageItem__systemNotificationDescription">
				{translate('furtherCounselling.card.defaultText')}
			</p>
			{note && (
				<div className="furtherCounsellingCard__note">
					<span className="furtherCounsellingCard__noteLabel">
						{translate('furtherCounselling.card.noteLabel')}
					</span>
					{/* Plain text by construction: React escapes it. */}
					<p className="furtherCounsellingCard__noteText">{note}</p>
				</div>
			)}
			{requested && (
				<p
					className="furtherCounsellingCard__status"
					role="status"
					data-cy="further-counselling-requested"
				>
					<CheckCircleOutlineRoundedIcon
						fontSize="small"
						aria-hidden
					/>
					{translate('furtherCounselling.card.requested')}
				</p>
			)}
			{viewerIsAsker && (
				<div className="furtherCounsellingCard__actions">
					<Button
						item={findAgencyButton}
						buttonHandle={() => setDialogOpen(true)}
						testingAttribute="further-counselling-find-agency"
					/>
				</div>
			)}
			{viewerIsAsker && dialogOpen && (
				<RecommendationRequestDialog
					topicId={topicId}
					onClose={() => setDialogOpen(false)}
					onRequestCreated={() => {
						markRequestedFromCard(messageId);
						setRequested(true);
					}}
				/>
			)}
		</div>
	);
};

/** Mounted only while open, so the prefill is read when it is needed. */
const RecommendationRequestDialog = ({
	topicId,
	onClose,
	onRequestCreated
}: {
	topicId: number;
	onClose: () => void;
	onRequestCreated: () => void;
}) => {
	const { prefilledPostcode, knownAgencyIds } =
		useFurtherCounsellingPrefill();
	return (
		<NewRequestDialog
			open
			onClose={onClose}
			preselectedTopicId={topicId}
			prefilledPostcode={prefilledPostcode}
			knownAgencyIds={knownAgencyIds}
			onRequestCreated={onRequestCreated}
		/>
	);
};
