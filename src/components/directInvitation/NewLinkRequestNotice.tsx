/**
 * The counsellor's notice when someone asks for a new link after a
 * Direkteinladung expired (#2252, decision 7): a pop-up on the app's snackbar
 * stack with a title and "Neuen Link senden", never a box in the page.
 */
import * as React from 'react';
import type { TFunction } from 'i18next';
import { M3Snackbar } from '../m3Snackbar/M3Snackbar';
import type { SnackbarStackEntryInput } from '../m3Snackbar/snackbarStack';

const KEYS = 'directInvitation.notice';

export interface NewLinkRequest {
	/** The invitation asked about; one pop-up per invitation. */
	invitationId: string;
	invitationName: string;
	/** Who asked, if the request names them. */
	requesterName?: string;
}

export interface NewLinkRequestSnackbarProps extends NewLinkRequest {
	t: TFunction;
	onSendNewLink: () => void;
	onClose: () => void;
}

/** The surface itself, inline, for the stack (and stories). */
export const NewLinkRequestSnackbar = ({
	t,
	invitationName,
	requesterName,
	onSendNewLink,
	onClose
}: NewLinkRequestSnackbarProps) => (
	<M3Snackbar
		placement="inline"
		role="status"
		testId="new-link-request"
		message={
			<>
				<strong className="newLinkRequest__title">
					{t(`${KEYS}.title`)}
				</strong>
				<span className="newLinkRequest__text">
					{t(`${KEYS}.text`, {
						name: requesterName || t(`${KEYS}.someone`),
						invitation: invitationName
					})}
				</span>
			</>
		}
		action={{ label: t(`${KEYS}.send`), onClick: onSendNewLink }}
		actionOnOwnLine
		onClose={onClose}
		closeLabel={t('app.close')}
		sx={{ maxWidth: 'none' }}
	/>
);

/**
 * A stack entry for `appSnackbarStack.enqueue`. The id makes a second request
 * for the same invitation replace the first instead of stacking.
 */
export const newLinkRequestEntry = (
	request: NewLinkRequest,
	t: TFunction,
	/** `false` (or a promise of it): the link was not made, keep the pop-up. */
	onSendNewLink: (
		request: NewLinkRequest
	) => boolean | void | Promise<boolean | void>
): SnackbarStackEntryInput => ({
	id: `new-link-request-${request.invitationId}`,
	announcement: t(`${KEYS}.title`),
	dismissible: true,
	render: ({ dismiss }) => (
		<NewLinkRequestSnackbar
			{...request}
			t={t}
			onSendNewLink={async () => {
				/* Gone only once the new link exists; after a failure the
				   counsellor can try again from here. */
				if ((await onSendNewLink(request)) !== false) dismiss();
			}}
			onClose={dismiss}
		/>
	)
});
