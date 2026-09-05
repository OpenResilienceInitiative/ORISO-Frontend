import * as React from 'react';
import DoneAllIcon from '@mui/icons-material/DoneAll';

interface MarkAllReadButtonProps {
	/** True when at least one activity event is unread. */
	hasUnread: boolean;
	onClick: () => void;
	/** Localised "Mark all as read"; used as tooltip and accessible name. */
	label: string;
}

/**
 * The Activity Timeline's bulk-read action (#1200 JOB1). It marks every
 * activity event of the signed-in user as read (UserService
 * `PATCH event-notifications/read-all`); it never touches Matrix read
 * receipts. Disabled when nothing is unread so pressing it is never a silent
 * no-op.
 */
export const MarkAllReadButton: React.FC<MarkAllReadButtonProps> = ({
	hasUnread,
	onClick,
	label
}) => (
	<button
		type="button"
		className="sessionsListToolbar__chip sessionsListToolbar__chip--iconOnly"
		onClick={onClick}
		disabled={!hasUnread}
		title={label}
		aria-label={label}
	>
		<DoneAllIcon className="sessionsListToolbar__chipIconSvg" />
	</button>
);
