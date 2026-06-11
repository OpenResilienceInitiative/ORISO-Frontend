import * as React from 'react';
import { useState, useEffect } from 'react';
import { Switch, FormControlLabel, Box, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getMatrixHomeserverUrl } from '../../resources/scripts/runtimeConfig';
import './uiVersionToggle.styles.scss';

const UI_VERSION_COOKIE = 'ui-version';
const UI_VERSION_STORAGE = 'ui-version';

export const UIVersionToggle = () => {
	const { t } = useTranslation();
	const [useNewUI, setUseNewUI] = useState(() => {
		// Determine current UI based on port
		// Port 8087 = Element (New UI), Port 9001 = Classic UI
		const currentPort = window.location.port;

		// If on Element (8087), toggle should be ON
		// If on Classic (9001), toggle should be OFF
		return currentPort === '8087';
	});

	const toggleUI = () => {
		const newVersion = useNewUI ? 'classic' : 'new';

		// Save preference
		localStorage.setItem(UI_VERSION_STORAGE, newVersion);

		// Set cookie with cross-subdomain support
		const plainHosts = (
			process.env.REACT_APP_HOSTNAMES_WITHOUT_COOKIE_DOMAIN ||
			'91.99.219.182,localhost'
		)
			.split(',')
			.map((h) => h.trim())
			.filter(Boolean);
		const useSharedCookieDomain =
			plainHosts.length === 0 ||
			!plainHosts.includes(window.location.hostname);
		const cookieDomainFromEnv = process.env.REACT_APP_COOKIE_DOMAIN?.trim();
		const uiVersionCookieDomain =
			useSharedCookieDomain && cookieDomainFromEnv
				? `; domain=${cookieDomainFromEnv}`
				: '';
		const secure = window.location.protocol === 'https:' ? '; secure' : '';
		const expiryDate = new Date();
		expiryDate.setDate(expiryDate.getDate() + 30);
		document.cookie = `${UI_VERSION_COOKIE}=${newVersion}; path=/; expires=${expiryDate.toUTCString()}; SameSite=Lax${uiVersionCookieDomain}${secure}`;

		// Redirect to Element UI or reload
		if (newVersion === 'new') {
			const matrixUserId = localStorage.getItem('matrix_user_id');
			const matrixAccessToken = localStorage.getItem(
				'matrix_access_token'
			);
			const matrixDeviceId = localStorage.getItem('matrix_device_id');
			const homeserverUrl = getMatrixHomeserverUrl();
			if (!homeserverUrl) {
				alert(
					'REACT_APP_MATRIX_HOMESERVER_URL is not set; cannot sync Matrix cookies for the new UI.'
				);
				return;
			}

			if (matrixUserId && matrixAccessToken) {
				const matrixCookieDomain = process.env.REACT_APP_COOKIE_DOMAIN;
				const isSecure = process.env.REACT_APP_USE_HTTPS === 'true';

				const domainStr = matrixCookieDomain
					? `; domain=${matrixCookieDomain}`
					: '';
				const secureStr = isSecure ? '; secure' : '';

				document.cookie = `matrix_sso_user_id=${encodeURIComponent(matrixUserId)}; path=/; SameSite=Lax${domainStr}${secureStr}`;
				document.cookie = `matrix_sso_access_token=${encodeURIComponent(matrixAccessToken)}; path=/; SameSite=Lax${domainStr}${secureStr}`;
				document.cookie = `matrix_sso_device_id=${encodeURIComponent(matrixDeviceId || '')}; path=/; SameSite=Lax${domainStr}${secureStr}`;
				document.cookie = `matrix_sso_hs_url=${encodeURIComponent(homeserverUrl)}; path=/; SameSite=Lax${domainStr}${secureStr}`;
			}

			const elementUrl = process.env.REACT_APP_ELEMENT_URL?.trim();
			if (!elementUrl) {
				alert(
					'REACT_APP_ELEMENT_URL is not set; cannot open the Element UI.'
				);
				return;
			}

			window.location.href = elementUrl;
		} else {
			// Reload to Classic UI
			window.location.reload();
		}
	};

	return (
		<Box
			className="ui-version-toggle"
			sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
		>
			<Chip
				label="BETA"
				size="small"
				color="primary"
				variant="outlined"
				sx={{ display: useNewUI ? 'none' : 'inline-flex' }}
			/>
			<FormControlLabel
				control={
					<Switch
						checked={useNewUI}
						onChange={toggleUI}
						color="primary"
						size="small"
					/>
				}
				label={
					<span className="ui-version-toggle__label">
						{useNewUI ? t('app.ui.new') : t('app.ui.classic')}
					</span>
				}
				labelPlacement="start"
			/>
		</Box>
	);
};
