import React, { useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiUrl, endpoints } from '../../resources/scripts/endpoints';
import { apiPostRegistration } from '../../api/apiPostRegistration';
import { TenantContext } from '../../globalState';
import { redirectToApp } from '../registration/autoLogin';
import { StageLayout } from '../stageLayout/StageLayout';
import { Stage } from '../stage/stage';

/**
 * Landing page for invite links. Reads the token from the URL, redeems it
 * with the userservice to obtain the pre-selected agency/consulting-type,
 * generates throw-away credentials, and runs the standard asker
 * registration (which auto-logs in). On success, redirects into the app.
 */
export const InviteLink = () => {
	const { t } = useTranslation();
	const { token } = useParams<{ token: string }>();
	const { tenant } = useContext<any>(TenantContext as any);
	const [status, setStatus] = useState<
		'loading' | 'registering' | 'error' | 'ok'
	>('loading');
	const [errorMessage, setErrorMessage] = useState('');
	// Guard so the async redeem+register flow can only run once per mount.
	// React StrictMode or an async-populated `tenant` can otherwise cause a
	// second invocation whose redeem-call fails with 400 "already used".
	const hasRunRef = useRef(false);

	useEffect(() => {
		if (!token) {
			setStatus('error');
			setErrorMessage('Missing token');
			return;
		}
		if (hasRunRef.current) return;
		hasRunRef.current = true;

		const redeemUrl = `${apiUrl}/service/users/invitelinks/${encodeURIComponent(
			token
		)}/redeem`;

		// Mirror the existing /anonymous flow: username starts with
		// `Anonymous-` so the session is routed to the Live-Chat filter
		// (consultant view classifies it by username prefix / postcode 00000),
		// and password is 8 chars alphanumeric to match what the anonymous
		// chat form generates (see AnonymousChat.tsx).
		const generatePassword = () => {
			const chars =
				'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
			let pw = '';
			for (let i = 0; i < 8; i++) {
				pw += chars.charAt(Math.floor(Math.random() * chars.length));
			}
			return pw;
		};

		const generateUsername = () => `Anonymous-${Date.now()}`;

		(async () => {
			try {
				const redeemResp = await fetch(redeemUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include'
				});
				if (!redeemResp.ok) {
					const body = await redeemResp.text().catch(() => '');
					throw new Error(
						body || `Redeem failed (HTTP ${redeemResp.status})`
					);
				}
				const info: {
					tenantId: number;
					agencyId: number;
					consultingTypeId: number | null;
				} = await redeemResp.json();

				setStatus('registering');

				const username = generateUsername();
				const password = generatePassword();

				await apiPostRegistration(
					endpoints.registerAsker,
					{
						username,
						password: encodeURIComponent(password),
						agencyId: String(info.agencyId),
						postcode: '00000',
						termsAccepted: 'true',
						preferredLanguage: 'de',
						consultingType:
							info.consultingTypeId != null
								? String(info.consultingTypeId)
								: '0'
					} as any,
					false,
					tenant as any
				);
				setStatus('ok');
				redirectToApp();
			} catch (err: any) {
				setStatus('error');
				setErrorMessage(
					err?.message || 'Invite link could not be used'
				);
			}
		})();
		// Intentionally only depend on token — tenant is read lazily inside
		// the effect and we do NOT want a tenant-arrival re-run.
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
