import React, { useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiUrl, endpoints } from '../../resources/scripts/endpoints';
import { apiPostRegistration } from '../../api/apiPostRegistration';
import { TenantContext } from '../../globalState';
import { setTokens } from '../auth/auth';
import { setValueInCookie } from '../sessionCookie/accessSessionCookie';
import { generateCsrfToken } from '../../utils/generateCsrfToken';
import { redirectToApp } from '../registration/autoLogin';
import { StageLayout } from '../stageLayout/StageLayout';
import { Stage } from '../stage/stage';

export const InviteLink = () => {
	const { t } = useTranslation();
	const { token } = useParams<{ token: string }>();
	const { tenant } = useContext<any>(TenantContext as any);
	const [status, setStatus] = useState<'loading' | 'registering' | 'error'>(
		'loading'
	);
	const [errorMessage, setErrorMessage] = useState('');
	const hasRunRef = useRef(false);

	useEffect(() => {
		if (!token || hasRunRef.current) return;
		hasRunRef.current = true;

		const redeemUrl = `${apiUrl}/service/users/invitelinks/${encodeURIComponent(token)}/redeem`;

		(async () => {
			try {
				const res = await fetch(redeemUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include'
				});

				if (!res.ok) {
					const body = await res.text().catch(() => '');
					throw new Error(
						body || `Redeem failed (HTTP ${res.status})`
					);
				}

				const data = await res.json();

				// New flow: backend already created the session, use credentials directly
				if (data.accessToken) {
					setTokens(
						data.accessToken,
						data.expiresIn,
						data.refreshToken,
						data.refreshExpiresIn
					);
					setValueInCookie('rc_uid', data.rcUserId);
					setValueInCookie('rc_token', data.rcToken);
					localStorage.setItem('matrix_user_id', data.rcUserId);
					localStorage.setItem('matrix_access_token', data.rcToken);
					generateCsrfToken(true);
					redirectToApp(data.rcGroupId);
					return;
				}

				// Legacy flow: backend returned only agencyId/consultingTypeId,
				// generate credentials and register manually
				setStatus('registering');
				const chars =
					'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
				let password = '';
				for (let i = 0; i < 8; i++) {
					password += chars.charAt(
						Math.floor(Math.random() * chars.length)
					);
				}
				const username = `Anonymous-${Date.now()}`;

				await apiPostRegistration(
					endpoints.registerAsker,
					{
						username,
						password: encodeURIComponent(password),
						agencyId: String(data.agencyId),
						postcode: '00000',
						termsAccepted: 'true',
						preferredLanguage: 'de',
						consultingType:
							data.consultingTypeId != null
								? String(data.consultingTypeId)
								: '0'
					} as any,
					false,
					tenant as any
				);
				redirectToApp();
			} catch (err: any) {
				setStatus('error');
				setErrorMessage(
					err?.message || 'Invite link could not be used'
				);
			}
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [token]);

	return (
		<StageLayout
			stage={<Stage hasAnimation={false} isReady={true} />}
			showLegalLinks
			showRegistrationLink={false}
		>
			<div style={{ maxWidth: 480, margin: '40px auto', padding: 16 }}>
				{(status === 'loading' || status === 'registering') && (
					<p>
						{t(
							'registration.registering',
							'Registrierung läuft...'
						)}
					</p>
				)}
				{status === 'error' && (
					<div>
						<h3>
							{t(
								'inviteLink.error.title',
								'This invite link can no longer be used'
							)}
						</h3>
						<p>{errorMessage}</p>
					</div>
				)}
			</div>
		</StageLayout>
	);
};
