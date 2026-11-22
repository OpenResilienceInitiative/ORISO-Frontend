import * as React from 'react';
import clsx from 'clsx';
import { SessionCardBody } from '../sessionsListItem/SessionCardBody/SessionCardBody';
import { DeletedAskerAvatar } from './DeletedAskerAvatar';
import '../sessionsListItem/sessionsListItem.styles';
import type { DeletedAskerRow } from './deletedAskerRows';

/**
 * ORISO-Frontend#1159: where a deleted advice-seeker chat used to be. The same
 * card as every conversation — chip row with the date, neutral avatar, title,
 * one muted line — so the list keeps its rhythm. Opening it shows the deletion
 * notice, from where the counsellor moves it into the archive.
 */
export const DeletedAskerListItem = ({
	row,
	locale,
	translate,
	isActive = false,
	onOpen
}: {
	row: DeletedAskerRow;
	locale: string;
	translate: (key: string, options?: Record<string, unknown>) => string;
	isActive?: boolean;
	onOpen?: (row: DeletedAskerRow) => void;
}) => {
	const title = translate('sessionList.deletedAsker.title');
	const date = Number.isFinite(row.timestamp)
		? new Date(row.timestamp).toLocaleDateString(locale.split('@')[0])
		: '';
	const open = () => onOpen?.(row);
	return (
		<div
			className={clsx(
				'sessionsListItem',
				'sessionsListItem--read',
				'sessionsListItem--deletedAsker',
				isActive && 'sessionsListItem--active'
			)}
			data-cy="sessions-list-deleted-asker-item"
		>
			<div
				className={clsx(
					'sessionsListItem__content',
					'sessionsListItem__content--flow',
					isActive && 'sessionsListItem__content--active'
				)}
				role="listitem"
				tabIndex={onOpen ? 0 : -1}
				aria-current={isActive ? 'true' : undefined}
				aria-label={`${title}, ${date}`}
				onClick={open}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						open();
					}
				}}
			>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__rowLeft" />
					<div className="sessionsListItem__rowRight">
						<div className="sessionsListItem__date">{date}</div>
					</div>
				</div>
				<SessionCardBody
					avatar={<DeletedAskerAvatar />}
					name={
						<div className="sessionsListItem__username sessionsListItem__username--readLabel">
							{title}
						</div>
					}
					preview={
						<span className="sessionsListItem__subject sessionsListItem__deletedAskerPreview">
							{translate(
								row.archived
									? 'sessionList.deletedAsker.previewArchived'
									: 'sessionList.deletedAsker.preview'
							)}
						</span>
					}
				/>
			</div>
		</div>
	);
};
