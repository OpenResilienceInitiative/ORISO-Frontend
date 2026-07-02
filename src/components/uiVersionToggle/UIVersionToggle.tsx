import * as React from 'react';
import { useState } from 'react';
import { Switch, FormControlLabel, Box, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
	getCookieDomain,
	getElementUrl,
	getHostnamesWithoutCookieDomain,
	getUseHttps
} from '../../resources/scripts/runtimeConfig';
import './uiVersionToggle.styles.scss';

const UI_VERSION_COOKIE = 'ui-version';
const UI_VERSION_STORAGE = 'ui-version';

const isElementUiOrigin = (): boolean => {
	const elementUrl = getElementUrl();
	if (!elementUrl) {
		return false;
	}

	try {
		return window.location.origin === new URL(elementUrl).origin;
	} catch {
		return false;
	}
};

export const UIVersionToggle = () => {
	const { t } = useTranslation();
	const [useNewUI, setUseNewUI] = useState(isElementUiOrigin);

	const toggleUI = async () => {
		const newVersion = useNewUI ? 'classic' : 'new';

		localStorage.setItem(UI_VERSION_STORAGE, newVersion);

		const plainHosts = getHostnamesWithoutCookieDomain();
		const useSharedCookieDomain =
			plainHosts.length === 0 ||
			!plainHosts.includes(window.location.hostname);
		const cookieDomain = getCookieDomain();
		const uiVersionCookieDomain =
			useSharedCookieDomain && cookieDomain
				? `; domain=${cookieDomain}`
				: '';
		const secure = window.location.protocol === 'https:' ? '; secure' : '';
		const expiryDate = new Date();
		expiryDate.setDate(expiryDate.getDate() + 30);
		document.cookie = `${UI_VERSION_COOKIE}=${newVersion}; path=/; expires=${expiryDate.toUTCString()}; SameSite=Lax${uiVersionCookieDomain}${secure}`;

		if (newVersion === 'new') {
			const elementUrl = getElementUrl();
			if (!elementUrl) {
				alert(
					'REACT_APP_ELEMENT_URL is not set; cannot open the Element UI.'
				);
				return;
			}

			try {
				const { getMatrixAccessToken } = await import(
					'../sessionCookie/getMatrixAccessToken'
				);
				const matrixLoginData = await getMatrixAccessToken();
				const homeserverUrl = matrixLoginData.homeserverUrl;
				const isSecure = getUseHttps();
				const secureStr = isSecure ? '; secure' : '';
				document.cookie = `matrix_sso_user_id=${encodeURIComponent(matrixLoginData.userId)}; path=/; SameSite=Lax${secureStr}`;
				document.cookie = `matrix_sso_access_token=${encodeURIComponent(matrixLoginData.accessToken)}; path=/; SameSite=Lax${secureStr}`;
				document.cookie = `matrix_sso_device_id=${encodeURIComponent(matrixLoginData.deviceId)}; path=/; SameSite=Lax${secureStr}`;
				document.cookie = `matrix_sso_hs_url=${encodeURIComponent(homeserverUrl)}; path=/; SameSite=Lax${secureStr}`;
			} catch (error) {
				console.error(
					'Failed to fetch Matrix credentials for UI toggle:',
					error
				);
			}

			window.location.href = elementUrl;
			return;
		} else {
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
