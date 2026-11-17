/**
 * #2252: a Direkteinladung action failed. Every such failure is a pop-up on
 * the snackbar stack with a title, a short text and a close control, never a
 * box in the page (component discipline, "Notifications are pop-ups").
 * Errors stay until they are dismissed.
 */
import * as React from 'react';
import type { TFunction } from 'i18next';
import { M3Snackbar } from '../m3Snackbar/M3Snackbar';
import type { SnackbarStackEntryInput } from '../m3Snackbar/snackbarStack';
import './directInvitation.styles.scss';

export const invitationErrorEntry = ({
	id,
	title,
	text,
	t
}: {
	/** The same failure twice replaces the first pop-up instead of stacking. */
	id: string;
	/** Already translated. */
	title: string;
	/** Already translated. */
	text: string;
	t: TFunction | ((key: string) => string);
}): SnackbarStackEntryInput => ({
	id,
	announcement: `${title}. ${text}`,
	dismissible: true,
	render: ({ dismiss }) => (
		<M3Snackbar
			placement="inline"
			role="alert"
			tone="error"
			testId={id}
			message={
				<>
					<strong className="newLinkRequest__title">{title}</strong>
					<span className="newLinkRequest__text">{text}</span>
				</>
			}
			onClose={dismiss}
			closeLabel={t('app.close')}
			sx={{ maxWidth: 'none' }}
		/>
	)
});
