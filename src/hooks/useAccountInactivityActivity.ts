import { useEffect } from 'react';
import { getValueFromCookie } from '../components/sessionCookie/accessSessionCookie';
import { reportAccountInactivityActivity } from '../api/apiReportAccountInactivityActivity';
import { parseJwt } from '../utils/parseJWT';

const REPORT_INTERVAL_MS = 60_000;
interface AccountReportState {
	subject: string;
	lastSuccess: number | null;
	pending?: AbortController;
}

/** Reports deliberate use, never elapsed time, polling or refreshed credentials. */
export const useAccountInactivityActivity = () => {
	useEffect(() => {
		let account: AccountReportState | undefined;
		let disposed = false;
		const reportGesture = (event: Event) => {
			if (
				!event.isTrusted ||
				document.visibilityState !== 'visible' ||
				!document.hasFocus()
			)
				return;
			const token = getValueFromCookie('keycloak');
			const subject = parseJwt(token)?.sub;
			if (typeof subject !== 'string' || !subject) {
				account?.pending?.abort();
				account = undefined;
				return;
			}
			if (account?.subject !== subject) {
				account?.pending?.abort();
				account = { subject, lastSuccess: null };
			}
			if (
				account.pending ||
				(account.lastSuccess !== null &&
					Date.now() - account.lastSuccess < REPORT_INTERVAL_MS)
			)
				return;
			const currentAccount = account;
			const controller = new AbortController();
			currentAccount.pending = controller;
			reportAccountInactivityActivity(token, controller.signal)
				.then((success) => {
					if (success && !disposed && account === currentAccount)
						currentAccount.lastSuccess = Date.now();
				})
				.catch(() => undefined)
				.finally(() => {
					if (account === currentAccount)
						currentAccount.pending = undefined;
				});
		};
		document.addEventListener('pointerdown', reportGesture, true);
		document.addEventListener('keydown', reportGesture, true);
		return () => {
			disposed = true;
			document.removeEventListener('pointerdown', reportGesture, true);
			document.removeEventListener('keydown', reportGesture, true);
			account?.pending?.abort();
		};
	}, []);
};
