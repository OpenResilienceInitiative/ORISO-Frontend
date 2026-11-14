import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DirectLinkCard, DirectLinkDraft } from './DirectLinkCard';
import { DirectLinkShareDialog } from './DirectLinkShareDialog';
import { DirectLink, DirectLinkMedium } from './directLink';
import { agencyForTopic } from './directLinkAvailability';
import { useDirectLinks } from './useDirectLinks';
import { InvitationDialog } from '../../directInvitation/InvitationDialog';
import type { InvitationDialogValue } from '../../directInvitation/invitationModel';
import { directInvitationSettings } from '../../directInvitation/directInvitationSettings';

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
	/**
	 * Hands the created link to the caller, which then shows the share
	 * dialog itself. The card unmounts when the layout switches between the
	 * picker's cards and a phone's rows (window resized, phone turned), and
	 * a dialog inside it would vanish with it.
	 */
	onCreated?: (link: DirectLink) => void;
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
	onRetryTopics,
	onCreated
}: DirectLinkCreateCardProps) => {
	const { t } = useTranslation();
	const { create } = useDirectLinks({ load: false });
	const [submitting, setSubmitting] = useState(false);
	const [failed, setFailed] = useState(false);
	const [ownShared, setOwnShared] = useState<DirectLink>();
	/* #2252: the card's choice waits for the dialog's appointment and settings. */
	const [draft, setDraft] = useState<DirectLinkDraft>();
	const shared = onCreated ? undefined : ownShared;
	const setShared = onCreated ?? setOwnShared;

	const handleCreate = async (value: InvitationDialogValue) => {
		if (!draft || submitting) return;
		const { topic, medium, name } = draft;
		const topicId = Number(topic);
		if (!Number.isFinite(topicId)) return;
		setSubmitting(true);
		setFailed(false);
		try {
			const agencyId = agencyForTopic(agencies, topicId);
			// #2142: the typed name wins; without one the link is named after its topic.
			const label =
				name || topics.find((option) => option.value === topic)?.label;
			const settings = directInvitationSettings(value);
			const created = await create({
				medium,
				topicId,
				temporary: settings.accessMode !== 'ACCOUNTS_ONLY',
				...(label ? { name: label } : {}),
				...settings,
				...(agencyId !== undefined ? { agencyId } : {})
			});
			setDraft(undefined);
			setShared(created);
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
				onCreate={(next) => {
					setFailed(false);
					setDraft(next);
				}}
				isSubmitting={submitting}
				topicsLoadFailed={topicsLoadFailed}
				onRetryTopics={onRetryTopics}
				settingsInDialog
			/>
			{draft && (
				<InvitationDialog
					variant="invitation"
					fullScreen={compact}
					saving={submitting}
					error={
						failed ? t('directLink.card.createFailed') : undefined
					}
					onSubmit={handleCreate}
					onClose={() => {
						if (submitting) return;
						setDraft(undefined);
						setFailed(false);
					}}
				/>
			)}
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
