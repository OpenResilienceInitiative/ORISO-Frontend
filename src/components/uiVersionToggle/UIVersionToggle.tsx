import * as React from 'react';
import { useState } from 'react';
import { Switch, FormControlLabel, Box, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
	getCookieDomain,
	getElementUrl,
	getHostnamesWithoutCookieDomain
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
	const [useNewUI] = useState(isElementUiOrigin);

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
				alert(t('calls.error.elementUrlMissing'));
				return;
			}

			// #1071/#196: the four `matrix_sso_*` handoff cookies that used to
			// be written here are gone. They carried the full Matrix access
			// token — the whole chat identity — in a JS-readable cookie, and
			// no longer served any purpose: their only consumer,
			// `element-sso-bridge.html`, was deleted with #231, and since #201
			// dropped the `domain=` attribute they are host-scoped, so the
			// Element origin could not read them anyway. Element performs its
			// own SSO login. Leftovers on long-lived profiles are expired on
			// logout by `clearMatrixSsoHandoffCookies`.
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
