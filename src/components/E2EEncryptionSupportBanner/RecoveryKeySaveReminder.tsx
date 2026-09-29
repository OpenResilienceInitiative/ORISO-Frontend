import './E2EEncryptionSupportBanner.styles.scss';
import { Link } from 'react-router-dom';
import * as React from 'react';
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserDataContext } from '../../globalState';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import {
	clearPendingRecoveryKey,
	usePendingRecoveryKey
} from '../../services/pendingRecoveryKeyStore';
import {
	dismissRecoveryReminder,
	isActionableRecoveryStatus,
	useRecoveryReminder,
	useRecoveryRuntimeStatus
} from '../../services/recoveryReminderState';

/** Enquiry success and backup readiness are independent; this never opens a modal. */
export const RecoveryKeySaveReminder = () => {
	const { t } = useTranslation();
	const { matrixClientService } = useMatrixClient();
	const userId = matrixClientService?.getClient()?.getUserId() ?? '';
	const eligible = useRecoveryReminder(userId);
	const status = useRecoveryRuntimeStatus(userId);
	const passwordMode =
		useContext(UserDataContext)?.userData?.chatRecoveryMode ===
		'LOGIN_PASSWORD';
	const key = usePendingRecoveryKey(userId);
	const [shownFor, setShownFor] = useState<string | null>(null);
	const [hiddenFor, setHiddenFor] = useState<string | null>(null);
	const showKey = shownFor === userId;
	// The login password already guards the key; Sicherheit still offers it.
	const protectedByPassword =
		passwordMode && (status === 'ready' || status === 'device-ready');
	if (
		!eligible ||
		protectedByPassword ||
		(!key && hiddenFor === userId) ||
		(!key && isActionableRecoveryStatus(status)) ||
		(!key && (status === 'ready' || status === 'device-ready'))
	)
		return null;
	return (
		<aside
			className="encryption-recovery-notice"
			data-cy="recovery-key-save-reminder"
			aria-live="polite"
		>
			<p>
				{t(
					key
						? 'encryption.saveReminder.title'
						: status === 'busy'
							? 'encryption.saveReminder.busy'
							: status === 'pending' || status === 'idle'
								? 'encryption.saveReminder.pending'
								: 'encryption.saveReminder.unavailable'
				)}
			</p>
			{key && isActionableRecoveryStatus(status) && (
				<p>
					{t('encryption.passwordRecovery.' + status)}{' '}
					<Link to="/profile/einstellungen/sicherheit">
						{t('encryption.passwordRecovery.settings')}
					</Link>
				</p>
			)}
			{key ? (
				<>
					{showKey ? (
						<>
							<code data-cy="optional-recovery-key">{key}</code>
							<button
								type="button"
								onClick={() => {
									clearPendingRecoveryKey(userId);
									dismissRecoveryReminder(userId);
									setShownFor(null);
								}}
							>
								{t('encryption.saveReminder.confirm')}
							</button>
						</>
					) : (
						<button
							type="button"
							onClick={() => setShownFor(userId)}
						>
							{t('encryption.saveReminder.show')}
						</button>
					)}
				</>
			) : (
				<Link to="/profile/einstellungen/sicherheit">
					{t('encryption.saveReminder.retry')}
				</Link>
			)}
			<button
				type="button"
				onClick={() =>
					key ? dismissRecoveryReminder(userId) : setHiddenFor(userId)
				}
			>
				{t('encryption.saveReminder.later')}
			</button>
		</aside>
	);
};
