import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiGetTenantTheming } from '../api/apiGetTenantTheming';
import { TenantContext, useLocaleData } from '../globalState';
import { TenantDataInterface } from '../globalState/interfaces';
import getLocationVariables from './getLocationVariables';
import decodeHTML from './decodeHTML';
import decodeTenantAsset from './decodeTenantAsset';
import getSafeFaviconUrl from './getSafeFaviconUrl';
import applyBrandingFavicon from './applyBrandingFavicon';
import { useAppConfig } from '../hooks/useAppConfig';
import {
	applyPreviewFromLocation,
	applyTenantPalette
} from './theme/applyTenantTheme';

const getOrCreateHeadNode = (
	tagName: string,
	attributes?: Record<string, string>
) => {
	let selector = tagName;
	if (attributes) {
		selector += '[';
		selector += Object.entries(attributes)
			.map(([key, value]) => `${key}="${value}"`)
			.join(' ');
		selector += ']';
	}

	let node = document.querySelector(selector);
	if (!node) {
		node = document.createElement(tagName);
		if (attributes) {
			Object.entries(attributes).forEach(([key, value]) => {
				node.setAttribute(key, value);
			});
		}
		document.head.appendChild(node);
	}

	return node;
};

const applyTheming = (tenant: TenantDataInterface) => {
	if (tenant.theming) {
		// Seeds → OrisoScheme engine → --m3-* variables on the document
		// root. Without a stored seed (or with an invalid one) nothing is
		// injected and the compiled legacy palette keeps applying (UAT-E).
		// In Theme Builder preview mode (sandboxed admin iframe) the URL
		// seeds win over the stored tenant palette.
		if (!applyPreviewFromLocation(window.location.search)) {
			applyTenantPalette(tenant.theming);
		}

		getOrCreateHeadNode('meta', { name: 'theme-color' }).setAttribute(
			'content',
			tenant.theming.primaryColor
		);

		// The uploaded favicon has to reach anonymous visitors too — the login,
		// password-reset, invite, DPA-sign and registration routes all render
		// under this hook's provider, so applying it here covers them. Anything
		// getSafeFaviconUrl refuses (wrong scheme, still-encoded payload) leaves
		// the built-in icon in place rather than replacing it with a broken one.
		const favicon = getSafeFaviconUrl(tenant.theming.favicon);
		if (favicon) {
			applyBrandingFavicon(favicon);
		}
	}

	if (tenant.name) {
		getOrCreateHeadNode('title').textContent = tenant.name;
		getOrCreateHeadNode('meta', { property: 'og:title' }).setAttribute(
			'content',
			tenant.name
		);
	}
	if (tenant.content?.claim) {
		getOrCreateHeadNode('meta', { name: 'description' }).setAttribute(
			'content',
			tenant.content.claim
		);
		getOrCreateHeadNode('meta', {
			property: 'og:description'
		}).setAttribute('content', tenant.content.claim);
	}
};

const useTenantTheming = () => {
	const settings = useAppConfig();
	const tenantContext = useContext(TenantContext);
	const { locale } = useLocaleData();
	const { subdomain } = getLocationVariables();
	const [isLoadingTenant, setIsLoadingTenant] = useState(
		settings.useTenantService
	);

	const cypressTenantEnabled = useMemo(
		() => (window as any).Cypress?.env('TENANT_ENABLED'),
		[]
	);

	const onTenantServiceResponse = useCallback(
		(tenant: TenantDataInterface) => {
			if (!subdomain && cypressTenantEnabled !== '1') {
				tenantContext?.setTenant({ settings } as any);
			} else {
				// ToDo: See VIC-428 + VIC-427
				const decodedTenant = JSON.parse(JSON.stringify(tenant));

				// Branding assets go through decodeTenantAsset, not decodeHTML:
				// they end up in img[src] / link[href] and must not take a
				// detour through innerHTML. The optional chaining matters on the
				// anonymous path — a restricted tenant payload without theming
				// or content used to throw here, which silently dropped the
				// whole theming (favicon, title, palette) for logged-out
				// visitors.
				if (decodedTenant.theming) {
					decodedTenant.theming.logo = decodeTenantAsset(
						tenant.theming?.logo
					);
					decodedTenant.theming.associationLogo = decodeTenantAsset(
						tenant.theming?.associationLogo
					);
					decodedTenant.theming.favicon = decodeTenantAsset(
						tenant.theming?.favicon
					);
				}
				if (decodedTenant.content?.claim) {
					decodedTenant.content.claim = decodeHTML(
						tenant.content.claim
					);
				}
				if (tenant.name) {
					decodedTenant.name = decodeHTML(tenant.name);
				}

				applyTheming(decodedTenant);
				tenantContext?.setTenant(decodedTenant);
			}
			return;
		},
		[settings, subdomain, tenantContext, cypressTenantEnabled]
	);

	useEffect(() => {
		if (!settings.useTenantService) {
			return;
		}

		apiGetTenantTheming()
			.then(onTenantServiceResponse)
			.catch((error) => {
				// console.log('Theme could not be loaded', error);
			})
			.finally(() => {
				setIsLoadingTenant(false);
			});
		// False positive
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tenantContext?.setTenant, subdomain, locale]);

	return isLoadingTenant;
};

export default useTenantTheming;
