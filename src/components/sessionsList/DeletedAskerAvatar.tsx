import * as React from 'react';
import clsx from 'clsx';
import { ReactComponent as DeletedIcon } from '../../resources/img/icons/deleted.svg';
import './deletedAskerAvatar.styles.scss';

/**
 * The neutral avatar of a deleted advice seeker: no initials, no picture,
 * nothing that points to the person (#1159).
 */
export const DeletedAskerAvatar = ({
	size = 'card'
}: {
	size?: 'card' | 'header';
}) => (
	<div
		className={clsx('deletedAskerAvatar', `deletedAskerAvatar--${size}`)}
		aria-hidden="true"
		data-testid="deleted-asker-avatar"
	>
		<DeletedIcon focusable="false" />
	</div>
);
