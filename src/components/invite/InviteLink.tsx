import React, { useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { endpoints } from '../../resources/scripts/endpoints';
import { apiPostRegistration } from '../../api/apiPostRegistration';
import {
	isRedeemInviteLinkSessionResponse,
	redeemInviteLink
} from '../../api/apiRedeemInviteLink';
import { TenantContext } from '../../globalState';
import { redirectToApp } from '../registration/autoLogin';
import {
	applyRedeemSessionCredentials,
	redirectToInviteSession
} from './inviteLinkHelpers';
import { StageLayout } from '../stageLayout/StageLayout';
import { Stage } from '../stage/stage';

/**
 * Landing page for invite links.
 *
 * New topic-based links (External Inbounds): redeem creates an anonymous
 * session and returns tokens — user goes straight to the waiting room.
 *
 * Legacy agency links: redeem returns agency/consultingType; we register
 * an anonymous asker then redirect into the app (Rebuild behaviour).
 */
export const InviteLink = () => {
	const { t } = useTranslation();
	const { token } = useParams<{ token: string; topicSlug?: string }>();
	const { tenant } = useContext<any>(TenantContext as any);
	const [status, setStatus] = useState<'loading' | 'registering' | 'error'>(
		'loading'
	);
	const [errorMessage, setErrorMessage] = useState('');
	const hasRunRef = useRef(false);

	useEffect(() => {
		if (!token) {
			setStatus('error');
			setErrorMessage('Missing token');
			return;
		}
		if (hasRunRef.current) return;
		hasRunRef.current = true;

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
				const data = await redeemInviteLink(token);

				if (isRedeemInviteLinkSessionResponse(data)) {
					applyRedeemSessionCredentials(data);
					redirectToInviteSession(data);
					return;
				}

				setStatus('registering');

				const username = generateUsername();
				const password = generatePassword();

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
