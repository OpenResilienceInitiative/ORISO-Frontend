import * as React from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as BackIcon } from '../../resources/img/icons/arrow-left.svg';
import { ReactComponent as ArchiveIcon } from '../../resources/img/icons/inbox.svg';
import { ChatSystemMessageCard } from '../message/ChatSystemMessageCard';
import { DeletedAskerAvatar } from '../sessionsList/DeletedAskerAvatar';
import '../sessionHeader/sessionHeader.styles.scss';
import './deletedAskerSession.styles.scss';

export type DeletedAskerArchiveState = 'idle' | 'busy' | 'failed' | 'archived';

export interface DeletedAskerNoticeProps {
	translate: (key: string, options?: Record<string, unknown>) => string;
	/** Already formatted for the reader; null when the date is unknown. */
	deletedOn: string | null;
	archiveState: DeletedAskerArchiveState;
	/** Absent once the placeholder is in the archive: nothing left to do. */
	onArchive?: () => void;
	backPath: string;
}

/**
 * ORISO-Frontend#1159: the main chat window of a deleted advice-seeker chat.
 * A header like every conversation, then one system notice and the archive
 * action. The backend keeps no record of who deleted it, so the notice does
 * not guess (Frank, 2026-11-17: general text only).
 */
export const DeletedAskerNotice = ({
	translate,
	deletedOn,
	archiveState,
	onArchive,
	backPath
}: DeletedAskerNoticeProps) => (
	<div className="deletedAskerSession" data-cy="deleted-asker-session">
		<div className="sessionInfo deletedAskerSession__info">
			<div className="sessionInfo__headerWrapper deletedAskerSession__header">
				<Link
					to={backPath}
					className="sessionInfo__backButton"
					aria-label={translate('app.back')}
				>
					<BackIcon />
				</Link>
				<DeletedAskerAvatar size="header" />
				<h2 className="deletedAskerSession__title">
					{translate('sessionList.deletedAsker.title')}
				</h2>
			</div>
		</div>
		<div className="deletedAskerSession__body" role="status">
			<ChatSystemMessageCard
				title={translate('deletedAskerSession.notice.title')}
				subtitle={
					deletedOn
						? translate('deletedAskerSession.notice.deletedOn', {
								date: deletedOn
							})
						: undefined
				}
				dataCy="deleted-asker-notice"
			>
				<p className="deletedAskerSession__noticeBody">
					{translate('deletedAskerSession.notice.text')}
				</p>
			</ChatSystemMessageCard>
			{archiveState === 'archived' ? (
				<p
					className="deletedAskerSession__archived"
					data-cy="deleted-asker-archived"
				>
					<ArchiveIcon aria-hidden="true" focusable="false" />
					<span>{translate('deletedAskerSession.archived')}</span>
				</p>
			) : (
				<div className="deletedAskerSession__actions">
					<p className="deletedAskerSession__hint">
						{translate('deletedAskerSession.archiveHint')}
					</p>
					<button
						type="button"
						className="deletedAskerSession__archive"
						onClick={onArchive}
						disabled={!onArchive || archiveState === 'busy'}
						aria-busy={archiveState === 'busy'}
						data-cy="deleted-asker-archive"
					>
						<ArchiveIcon aria-hidden="true" focusable="false" />
						<span>{translate('chatFlyout.archive')}</span>
					</button>
					{archiveState === 'failed' && (
						<p
							className="deletedAskerSession__error"
							role="alert"
							data-cy="deleted-asker-archive-error"
						>
							{translate('deletedAskerSession.archiveFailed')}
						</p>
					)}
				</div>
			)}
		</div>
	</div>
);
