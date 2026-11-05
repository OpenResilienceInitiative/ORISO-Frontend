import * as React from 'react';
import type { DeletedAskerRow } from './deletedAskerRows';

/**
 * ORISO-Frontend#1159: where a deleted advice-seeker chat used to be. Not a
 * link and not focusable: there is nothing left to open.
 */
export const DeletedAskerListItem = ({
	row,
	locale,
	translate
}: {
	row: DeletedAskerRow;
	locale: string;
	translate: (key: string, options?: Record<string, unknown>) => string;
}) => (
	<div role="listitem">
		<div
			className="sessionsListDeletedAskerItem"
			data-cy="sessions-list-deleted-asker-item"
			aria-disabled="true"
		>
			<span className="sessionsListDeletedAskerItem__title">
				{translate('sessionList.deletedAsker.title')}
			</span>
			<span className="sessionsListDeletedAskerItem__meta">
				{new Date(row.timestamp).toLocaleDateString(locale)}
			</span>
			<span className="sessionsListDeletedAskerItem__hint">
				{translate('sessionList.deletedAsker.hint')}
			</span>
		</div>
	</div>
);
