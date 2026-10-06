import * as React from 'react';
import { useContext, useEffect, useMemo, useState } from 'react';
import i18n, { FALLBACK_LNG, init } from '../../i18n';
import { InformalContext } from './InformalProvider';
import { useAppConfig } from '../../hooks/useAppConfig';
import { setValueInCookie } from '../../components/sessionCookie/accessSessionCookie';
import { useTenant } from './TenantProvider';
import useTenantTheming from '../../utils/useTenantTheming';
import { LocaleContext, TLocaleContext } from '../context/LocaleContext';

export const STORAGE_KEY_LOCALE = 'locale';

/**
 * `init` reconfigures the shared i18n singleton. A tenant switch can start a
 * second initialisation while the first is pending, and the singleton keeps
 * whichever finished last — so the calls are queued: the newest one is always
 * the last to touch it.
 */
let i18nInitQueue: Promise<unknown> = Promise.resolve();

const queueI18nInit = (
	...args: Parameters<typeof init>
): ReturnType<typeof init> => {
	const run = i18nInitQueue.then(() => init(...args));
	i18nInitQueue = run.catch(() => undefined);
	return run;
};

export function LocaleProvider(props) {
	const settings = useAppConfig();
	const isLoading = useTenantTheming();
	const tenant = useTenant();
	const [initialized, setInitialized] = useState(false);
	// Which tenant language set the current list was built from. Signing in
	// swaps the tenant inside this provider, and the list has to follow —
	// otherwise a counsellor keeps the languages of the login screen's tenant.
	const [appliedLanguages, setAppliedLanguages] = useState<string | null>(
		null
	);
	const [initLocale, setInitLocale] = useState(null);
	const { informal } = useContext(InformalContext);
	const [locales, setLocales] = useState([]);
	const [locale, setLocale] = useState(
		localStorage.getItem(STORAGE_KEY_LOCALE) || null
	);

	const activeLanguagesKey = (tenant?.settings?.activeLanguages ?? []).join(
		','
	);

	useEffect(() => {
		// If using the tenant service we should load first the tenant because we need the
		// active languages from the server to apply it on loading
		if (settings.useTenantService && isLoading) {
			return;
		}
		if (initialized && appliedLanguages === activeLanguagesKey) {
			return;
		}

		// A tenant switch supersedes a pending initialisation: its answer
		// describes the previous Träger's languages and must not be committed.
		let isCurrent = true;

		queueI18nInit(
			{
				...settings.i18n,
				...(tenant?.settings?.activeLanguages && {
					supportedLngs: [
						'de@informal',
						...(tenant?.settings?.activeLanguages || []),
						// If tenant service has 'de' active add default supported languages 'de' and 'de@informal'
						// If 'de' is deactivated 'de@informal' should not be available too
						...(settings.i18n.supportedLngs &&
						(tenant?.settings?.activeLanguages ?? []).includes('de')
							? settings.i18n.supportedLngs
							: [])
					]
				})
			},
			settings.translation
		)
			.then((supportedLanguages) => {
				if (!isCurrent) {
					return;
				}
				setLocales(supportedLanguages);
				setAppliedLanguages(activeLanguagesKey);
				setInitLocale(i18n.language);
				const locale =
					localStorage.getItem(STORAGE_KEY_LOCALE) ||
					i18n.language ||
					FALLBACK_LNG;

				setValueInCookie('lang', locale);
				setLocale(locale);
				setInitialized(true);
			})
			// A rejected initialisation must not leave the previous Träger's
			// language list standing: the counsellor would be offered
			// languages that belong to someone else's Träger. Fall back to
			// what the app itself is configured for, which is the most this
			// can honestly claim when the tenant's own list never loaded.
			.catch(() => {
				if (!isCurrent) {
					return;
				}
				// i18next types supportedLngs as `false | readonly string[]`.
				const configured = settings.i18n?.supportedLngs;
				const fallbackLanguages = (
					Array.isArray(configured) ? configured : [FALLBACK_LNG]
				).filter((lng: string) => lng.indexOf('@informal') < 0);
				setLocales(fallbackLanguages);
				setAppliedLanguages(activeLanguagesKey);
				setInitialized(true);
			});

		return () => {
			isCurrent = false;
		};
		// activeLanguagesKey is the stable derivation of the tenant's language
		// array; depending on the array itself would re-init on every new
		// object identity.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		activeLanguagesKey,
		appliedLanguages,
		initialized,
		isLoading,
		settings.i18n,
		settings.translation,
		settings.useTenantService
	]);

	const languagesReady =
		initialized &&
		(!settings.useTenantService ||
			(!isLoading && appliedLanguages === activeLanguagesKey));

	const selectableLocales = useMemo(() => {
		return languagesReady
			? locales.filter((lng) => lng.indexOf('@informal') < 0)
			: [];
	}, [languagesReady, locales]);

	useEffect(() => {
		if (!languagesReady) {
			return;
		}

		if (locale) {
			let lngCode = `${locale}${informal ? '@informal' : ''}`;
			if (!locales.includes(lngCode)) {
				// If language is x@informal try if only x exists
				lngCode = locale;
				if (!locales.includes(lngCode)) {
					// else fallback to default lng
					lngCode = FALLBACK_LNG;
				}
			}
			i18n.changeLanguage(lngCode);
			localStorage.setItem(STORAGE_KEY_LOCALE, locale);
			document.documentElement.lang = locale;
			setValueInCookie('lang', locale);
		}
	}, [locale, informal, locales, languagesReady]);

	const handleOnSetLocale = React.useCallback(
		(lng) => {
			if (languagesReady && locales?.includes?.(lng)) {
				setLocale(lng);
			}
		},
		[languagesReady, locales]
	);

	// Only the initial load blocks mounting. During sign-in the router and
	// in-flight registration callback must survive tenant resolution (#1475).
	// Withhold stale language choices instead of unmounting the whole app.
	if (!initialized) {
		return null;
	}

	return (
		<LocaleContext.Provider
			value={{
				locale,
				initLocale,
				setLocale: handleOnSetLocale,
				locales: languagesReady ? locales : [],
				selectableLocales
			}}
		>
			{props.children}
		</LocaleContext.Provider>
	);
}

export const useLocaleData = (): TLocaleContext => {
	return useContext(LocaleContext) || ({} as TLocaleContext);
};
