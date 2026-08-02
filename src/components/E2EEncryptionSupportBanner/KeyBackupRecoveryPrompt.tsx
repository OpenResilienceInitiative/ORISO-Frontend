import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Banner } from '../banner/Banner';
import { useMatrixClient } from '../../globalState/context/MatrixClientContext';
import { getEncryptionStatus } from '../../services/matrixKeyBackupService';
import './E2EEncryptionSupportBanner.styles.scss';

const DISMISS_KEY = 'hideKeyBackupPrompt';
const SECURITY_SETTINGS_PATH = '/profile/einstellungen/sicherheit';

/**
 * #437 login-time recovery prompt. On a new device the user's key backup is
 * "out of sync" — a server backup exists but this device holds no backup key,
 * so encrypted case history stays unreadable until they enter their recovery
 * key. Rather than making them hunt in profile settings, surface a dismissible
 * banner right after the Matrix client is ready that deep-links into the
 * Sicherheit panel (which owns the recovery-key input).
 *
 * Probes once per session, only after sync reaches PREPARED; dismissal is
 * session-scoped so we do not nag on every navigation.
 */
export const KeyBackupRecoveryPrompt = () => {
	const { t: translate } = useTranslation();
	const { matrixClientService } = useMatrixClient();
	const [bannerMode, setBannerMode] = useState<'setup' | 'recovery' | null>(
		null
	);
	const probedRef = useRef(false);

	useEffect(() => {
		if (!matrixClientService) {
			return undefined;
		}
		if (sessionStorage.getItem(DISMISS_KEY)) {
			return undefined;
		}

		let cancelled = false;

		const unsubscribe = matrixClientService.onSyncStateChange(
			(state: string | null) => {
				if (state !== 'PREPARED' || probedRef.current) {
					return;
				}
				probedRef.current = true;
				const client = matrixClientService.getClient();
				if (!client) {
					return;
				}
				getEncryptionStatus(client)
					.then((status) => {
						const setupRequired =
							!status.serverBackupExists ||
							!status.secretStorageReady ||
							!status.crossSigningReady;
						if (!cancelled && status.keyStorageOutOfSync) {
							setBannerMode('recovery');
						} else if (!cancelled && setupRequired) {
							setBannerMode('setup');
						}
					})
					.catch(() => {
						// Best-effort nudge — never surface crypto probe errors.
					});
			}
		);

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [matrixClientService]);

	useEffect(() => {
		const fn = bannerMode ? 'add' : 'remove';
		document.body.classList[fn]('banner-open');
	}, [bannerMode]);

	if (!bannerMode) {
		return null;
	}

	return (
		<Banner
			className="encryption-banner"
			onClose={() => {
				sessionStorage.setItem(DISMISS_KEY, 'true');
				setBannerMode(null);
			}}
		>
			<span className="keyBackupPrompt__text">
				{bannerMode === 'setup'
					? translate(
							'encryption.keyBackup.setupPrompt.text',
							'Richten Sie einen Wiederherstellungsschlüssel ein, damit Ihre verschlüsselten Gespräche auch auf einem neuen Gerät verfügbar bleiben.'
						)
					: translate(
							'encryption.keyBackup.prompt.text',
							'Ihr Gesprächsverlauf ist auf diesem Gerät noch nicht verfügbar. Geben Sie Ihren Wiederherstellungsschlüssel ein, um ihn hier weiterzulesen.'
						)}{' '}
				<Link
					to={SECURITY_SETTINGS_PATH}
					onClick={() => {
						sessionStorage.setItem(DISMISS_KEY, 'true');
						setBannerMode(null);
					}}
				>
					{bannerMode === 'setup'
						? translate(
								'encryption.keyBackup.setupPrompt.cta',
								'Wiederherstellung einrichten'
							)
						: translate(
								'encryption.keyBackup.prompt.cta',
								'Verlauf wiederherstellen'
							)}
				</Link>
			</span>
		</Banner>
	);
};
