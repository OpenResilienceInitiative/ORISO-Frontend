import { useEffect } from 'react';
import { getValueFromCookie } from '../components/sessionCookie/accessSessionCookie';
import { reportAccountInactivityActivity } from '../api/apiReportAccountInactivityActivity';
import { parseJwt } from '../utils/parseJWT';

const REPORT_INTERVAL_MS = 60_000;
// The endpoint is not deployed (yet): wait like after a success instead of retrying on every gesture.
const ENDPOINT_UNAVAILABLE = new Set([404, 405, 501]);
interface AccountReportState {
	subject: string;
	throttledAt: number | null;
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
				account = { subject, throttledAt: null };
			}
			if (
				account.pending ||
				(account.throttledAt !== null &&
					Date.now() - account.throttledAt < REPORT_INTERVAL_MS)
			)
				return;
			const currentAccount = account;
			const controller = new AbortController();
			currentAccount.pending = controller;
			reportAccountInactivityActivity(token, controller.signal)
				.then((status) => {
					const throttle =
						status === 204 || ENDPOINT_UNAVAILABLE.has(status);
					if (throttle && !disposed && account === currentAccount)
						currentAccount.throttledAt = Date.now();
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
