import React, { useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiUrl, endpoints } from '../../resources/scripts/endpoints';
import { apiPostRegistration } from '../../api/apiPostRegistration';
import { apiPutGroupChat, GROUP_CHAT_API } from '../../api/apiPutGroupChat';
import { TenantContext } from '../../globalState';
import { redirectToApp } from '../registration/autoLogin';
import { StageLayout } from '../stageLayout/StageLayout';
import { Stage } from '../stage/stage';
import {
	fetchData,
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS
} from '../../api/fetchData';
import { useAppConfig } from '../../hooks/useAppConfig';

type InviteRedeemPayload = {
	tenantId: number;
	agencyId: number;
	consultingTypeId: number | null;
	chatId?: number | null;
	groupChatId?: number | string | null;
	groupId?: string | null;
	gcid?: string | null;
	chat?: { id?: number | null } | null;
};

const isResponseLike = (value: any): value is Response =>
	value &&
	typeof value.status === 'number' &&
	typeof value.text === 'function';

const normalizeInviteRedeemPayload = (payload: any): InviteRedeemPayload => {
	const tenantId = Number(
		payload?.tenantId ?? payload?.tenant?.id ?? Number.NaN
	);
	const agencyId = Number(
		payload?.agencyId ?? payload?.agency?.id ?? Number.NaN
	);
	const consultingTypeRaw =
		payload?.consultingTypeId ?? payload?.consultingType?.id ?? null;
	const consultingTypeId =
		consultingTypeRaw == null ? null : Number(consultingTypeRaw);
	const chatIdRaw = payload?.chatId ?? null;
	const chatId = chatIdRaw == null ? null : Number(chatIdRaw);
	const groupChatIdRaw = payload?.groupChatId ?? null;
	const groupChatId =
		typeof groupChatIdRaw === 'number' || typeof groupChatIdRaw === 'string'
			? groupChatIdRaw
			: null;
	const groupId = payload?.groupId == null ? null : String(payload.groupId);
	const gcid = payload?.gcid == null ? null : String(payload.gcid);
	const nestedChatIdRaw = payload?.chat?.id ?? null;
	const nestedChatId =
		nestedChatIdRaw == null ? null : Number(nestedChatIdRaw);

	if (!Number.isFinite(tenantId) || tenantId <= 0) {
		throw new Error('Invite mapping is missing tenantId');
	}
	if (!Number.isFinite(agencyId) || agencyId <= 0) {
		throw new Error('Invite mapping is missing agencyId');
	}
	if (
		consultingTypeId != null &&
		(!Number.isFinite(consultingTypeId) || consultingTypeId <= 0)
	) {
		throw new Error('Invite mapping contains invalid consultingTypeId');
	}

	return {
		tenantId,
		agencyId,
		consultingTypeId,
		chatId:
			chatId != null && Number.isFinite(chatId) && chatId > 0
				? chatId
				: null,
		groupChatId,
		groupId,
		gcid,
		chat: {
			id:
				nestedChatId != null &&
				Number.isFinite(nestedChatId) &&
				nestedChatId > 0
					? nestedChatId
					: null
		}
	};
};

const classifyRedeemError = (error: unknown, t: any) => {
	const fallbackTitle = t(
		'inviteLink.error.title',
		'This invite link can no longer be used'
	);
	const fallbackMessage = t(
		'inviteLink.error.unknown',
		'The invite link could not be processed. Please request a new link.'
	);

	if (error instanceof Error && error.message) {
		return {
			title: fallbackTitle,
			message: error.message
		};
	}

	if (!isResponseLike(error)) {
		return {
			title: fallbackTitle,
			message: fallbackMessage
		};
	}

	const status = error.status;
	if (status === 404) {
		return {
			title: fallbackTitle,
			message: t(
				'inviteLink.error.invalid',
				'This invite link is invalid. Please request a new one.'
			)
		};
	}
	if (status === 409) {
		return {
			title: fallbackTitle,
			message: t(
				'inviteLink.error.used',
				'This invite link has already been used.'
			)
		};
	}
	if (status === 410) {
		return {
			title: fallbackTitle,
			message: t(
				'inviteLink.error.expired',
				'This invite link has expired. Please request a new one.'
			)
		};
	}
	if (status >= 500) {
		return {
			title: t(
				'inviteLink.error.serverTitle',
				'The service is currently unavailable'
			),
			message: t(
				'inviteLink.error.server',
				'Please try again in a few minutes.'
			)
		};
	}

	return {
		title: fallbackTitle,
		message: fallbackMessage
	};
};

const assignToGroupChat = async (chatId: number): Promise<void> => {
	try {
		await apiPutGroupChat(chatId, GROUP_CHAT_API.ASSIGN);
	} catch {
		// Non-fatal: user may already be a member; proceed to app anyway.
	}
};

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
	const settings = useAppConfig();
	const [status, setStatus] = useState<
		'redeeming' | 'registering' | 'error' | 'ok'
	>('redeeming');
	const [errorTitle, setErrorTitle] = useState(
		t('inviteLink.error.title', 'This invite link can no longer be used')
	);
	const [errorMessage, setErrorMessage] = useState('');
	const [retryCounter, setRetryCounter] = useState(0);
	const [statusMessage, setStatusMessage] = useState(
		t('inviteLink.redeeming', 'Einladungslink wird geprüft...')
	);
	// Guard so the async redeem+register flow can only run once per token+retry.
	// This protects against React StrictMode double-invocation.
	const runKeyRef = useRef('');

	useEffect(() => {
		const rawToken = token?.trim() || '';
		if (!rawToken) {
			setStatus('error');
			setErrorTitle(
				t(
					'inviteLink.error.title',
					'This invite link can no longer be used'
				)
			);
			setErrorMessage(
				t(
					'inviteLink.error.missingToken',
					'No invite token was found in the URL.'
				)
			);
			return;
		}

		const runKey = `${rawToken}::${retryCounter}`;
		if (runKeyRef.current === runKey) return;
		runKeyRef.current = runKey;

		const normalizedToken = rawToken;
		const redeemUrl = `${apiUrl}/service/users/invitelinks/${encodeURIComponent(
			normalizedToken
		)}/redeem`;

		const generatePassword = () => {
			const chars =
				'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
			let pw = '';
			for (let i = 0; i < 8; i++) {
				pw += chars.charAt(Math.floor(Math.random() * chars.length));
			}
			return pw;
		};

		const generateUsername = () =>
			`Anonymous-${Date.now()}${Math.floor(Math.random() * 1000)}`;

		(async () => {
			try {
				setStatus('redeeming');
				setStatusMessage(
					t('inviteLink.redeeming', 'Einladungslink wird geprüft...')
				);

				const rawRedeemPayload = await fetchData({
					url: redeemUrl,
					method: FETCH_METHODS.POST,
					skipAuth: true,
					responseHandling: [
						FETCH_SUCCESS.CONTENT,
						FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE
					]
				});
				const redeemPayload =
					normalizeInviteRedeemPayload(rawRedeemPayload);

				setStatus('registering');
				setStatusMessage(
					t('registration.registering', 'Registrierung läuft...')
				);

				const username = generateUsername();
				const password = generatePassword();
				const tenantPayload: any = tenant
					? {
							...tenant,
							id: redeemPayload.tenantId || tenant.id
						}
					: {
							id: redeemPayload.tenantId
						};

				await apiPostRegistration(
					endpoints.registerAsker,
					{
						username,
						password: encodeURIComponent(password),
						agencyId: String(redeemPayload.agencyId),
						postcode: '00000',
						termsAccepted: 'true',
						preferredLanguage: 'de',
						consultingType: redeemPayload.consultingTypeId
							? String(redeemPayload.consultingTypeId)
							: '0'
					} as any,
					Boolean(settings.multitenancyWithSingleDomainEnabled),
					tenantPayload
				);

				const inviteChatId =
					redeemPayload.chatId ??
					(() => {
						if (typeof redeemPayload.groupChatId === 'number') {
							return redeemPayload.groupChatId;
						}
						if (typeof redeemPayload.groupChatId === 'string') {
							const parsed = Number(redeemPayload.groupChatId);
							return Number.isFinite(parsed) && parsed > 0
								? parsed
								: null;
						}
						return null;
					})() ??
					redeemPayload.chat?.id ??
					null;
				const inviteGroupId =
					redeemPayload.gcid ??
					redeemPayload.groupId ??
					(typeof redeemPayload.groupChatId === 'string' &&
					!Number.isFinite(Number(redeemPayload.groupChatId))
						? redeemPayload.groupChatId
						: undefined);

				// Assign the user to the group chat immediately after login
				// so the session appears in the sessions list and the waiting
				// room is shown without any extra click.
				if (inviteChatId) {
					await assignToGroupChat(inviteChatId);
				}

				setStatus('ok');
				try {
					sessionStorage.setItem('isAnonymousInvite', '1');
					if (inviteGroupId) {
						sessionStorage.setItem(
							'pendingInviteGcid',
							inviteGroupId
						);
					}
					if (inviteChatId != null) {
						sessionStorage.setItem(
							'pendingInviteChatId',
							String(inviteChatId)
						);
					}
				} catch {
					/* ignore storage errors */
				}
				redirectToApp(inviteGroupId, inviteChatId);
			} catch (error: any) {
				if (isResponseLike(error)) {
					const responseBody =
						(await error.text().catch(() => '')) || '';
					const normalizedBody = responseBody.toLowerCase();

					if (normalizedBody.includes('expired')) {
						setStatus('error');
						setErrorTitle(
							t(
								'inviteLink.error.title',
								'This invite link can no longer be used'
							)
						);
						setErrorMessage(
							t(
								'inviteLink.error.expired',
								'This invite link has expired. Please request a new one.'
							)
						);
						return;
					}
					if (
						normalizedBody.includes('used') ||
						normalizedBody.includes('already redeemed')
					) {
						setStatus('error');
						setErrorTitle(
							t(
								'inviteLink.error.title',
								'This invite link can no longer be used'
							)
						);
						setErrorMessage(
							t(
								'inviteLink.error.used',
								'This invite link has already been used.'
							)
						);
						return;
					}
				}

				const classified = classifyRedeemError(error, t);
				setStatus('error');
				setErrorTitle(classified.title);
				setErrorMessage(classified.message);
			}
		})();
	}, [
		retryCounter,
		settings.multitenancyWithSingleDomainEnabled,
		t,
		tenant,
		token
	]);

	return (
		<StageLayout
			stage={<Stage hasAnimation={false} isReady={true} />}
			showLegalLinks
			showRegistrationLink={false}
		>
			<div style={{ maxWidth: 480, margin: '40px auto', padding: 16 }}>
				{(status === 'redeeming' || status === 'registering') && (
					<p>{statusMessage}</p>
				)}
				{status === 'error' && (
					<div>
						<h3>{errorTitle}</h3>
						<p>{errorMessage}</p>
						<button
							type="button"
							className="button-as-link"
							onClick={() =>
								setRetryCounter((value) => value + 1)
							}
						>
							{t('inviteLink.retry', 'Erneut versuchen')}
						</button>
					</div>
				)}
			</div>
		</StageLayout>
	);
};
