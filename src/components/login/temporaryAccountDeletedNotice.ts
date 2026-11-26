/**
 * A guest account from a direct link is deleted shortly after the conversation.
 * A tab that is still open then holds tokens for an account that is gone. The
 * API answers 401 with this reason, the app signs the guest out and the login
 * page says why (FE#2550).
 *
 * The marker travels in the URL because sign-out purges web storage. It names
 * a fixed notice and carries nothing about the person.
 */
export const TEMPORARY_ACCOUNT_DELETED_REASON = 'TEMPORARY_ACCOUNT_DELETED';

export const LOGIN_NOTICE_PARAM = 'notice';
export const TEMPORARY_ACCOUNT_DELETED_NOTICE = 'temporary-account-deleted';

export const loginUrlWithTemporaryAccountDeletedNotice = (
	loginUrl: string
): string =>
	`${loginUrl}${loginUrl.includes('?') ? '&' : '?'}${LOGIN_NOTICE_PARAM}=${TEMPORARY_ACCOUNT_DELETED_NOTICE}`;

export const isTemporaryAccountDeletedNotice = (
	notice: string | null | undefined
): boolean => notice === TEMPORARY_ACCOUNT_DELETED_NOTICE;
