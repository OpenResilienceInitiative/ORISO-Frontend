import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DirectLinkCard, DirectLinkDraft } from './DirectLinkCard';
import { DirectLinkShareDialog } from './DirectLinkShareDialog';
import { DirectLink, DirectLinkMedium } from './directLink';
import { agencyForTopic } from './directLinkAvailability';
import { useDirectLinks } from './useDirectLinks';

export interface DirectLinkCreateCardProps {
	/** The counsellor's topics, `value` = topic id. */
	topics: { value: string; label: string }[];
	/** The counsellor's Beratungsstellen, to name the one a topic belongs to. */
	agencies: { id: number; topicIds?: number[] | null }[];
	/** What "Direkteinladung erlauben" allows. */
	media: DirectLinkMedium[];
	/** "Fertig" in the share dialog. */
	onDone: () => void;
	/** Phones: the share dialog fills the screen. */
	compact?: boolean;
	className?: string;
	topicsLoadFailed?: boolean;
	onRetryTopics?: () => void;
}

/**
 * #1795 wired: the "Direktlink" card creates the link in the backend
 * (ORISO-UserService#1479), then the share dialog shows the real link and
 * QR code. "Fertig" hands back to the caller, which opens "Gespräche".
 */
export const DirectLinkCreateCard = ({
	topics,
	agencies,
	media,
	onDone,
	compact = false,
	className,
	topicsLoadFailed,
	onRetryTopics
}: DirectLinkCreateCardProps) => {
	const { t } = useTranslation();
	const { create } = useDirectLinks({ load: false });
	const [submitting, setSubmitting] = useState(false);
	const [failed, setFailed] = useState(false);
	const [shared, setShared] = useState<DirectLink>();

	const handleCreate = async ({
		topic,
		medium,
		temporary
	}: DirectLinkDraft) => {
		const topicId = Number(topic);
		if (!Number.isFinite(topicId) || submitting) return;
		setSubmitting(true);
		setFailed(false);
		try {
			const agencyId = agencyForTopic(agencies, topicId);
			const label = topics.find(
				(option) => option.value === topic
			)?.label;
			setShared(
				await create({
					medium,
					topicId,
					temporary,
					...(label ? { name: label } : {}),
					...(agencyId !== undefined ? { agencyId } : {})
				})
			);
		} catch {
			setFailed(true);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<>
			<DirectLinkCard
				className={className}
				topics={topics}
				media={media}
				onCreate={handleCreate}
				isSubmitting={submitting}
				topicsLoadFailed={topicsLoadFailed}
				onRetryTopics={onRetryTopics}
				errorMessage={
					failed ? t('directLink.card.createFailed') : undefined
				}
			/>
			{shared && (
				<DirectLinkShareDialog
					open
					link={shared}
					fullScreen={compact}
					onClose={() => {
						setShared(undefined);
						onDone();
					}}
				/>
			)}
		</>
	);
};
