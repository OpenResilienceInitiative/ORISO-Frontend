import * as React from 'react';
import { useEffect, useRef } from 'react';
import {
	AUTHORITIES,
	ConsultingTypesContext,
	LocaleContext,
	SessionsDataContext,
	TenantContext,
	UserDataContext
} from '../../globalState';

export const consultantUserData = {
	userId: 'consultant-storybook',
	userName: 'beraterin@example.invalid',
	displayName: 'Beraterin ORISO',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	agencies: [],
	appointmentFeatureEnabled: false,
	available: false,
	consultingTypes: {},
	e2eEncryptionEnabled: false,
	emailToggles: [],
	formalLanguage: false,
	hasArchive: true,
	isDisplayNameEditable: true,
	isWalkThroughEnabled: false,
	languages: ['de', 'en'],
	preferredLanguage: 'de',
	userRoles: ['CONSULTANT'],
	termsAndConditionsConfirmation: '',
	dataPrivacyConfirmation: '',
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
} as any;

export const askerUserData = {
	userId: 'asker-storybook',
	userName: 'ratsuchende@example.invalid',
	displayName: 'Ratsuchende',
	grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT],
	agencies: [],
	appointmentFeatureEnabled: false,
	available: false,
	consultingTypes: {},
	e2eEncryptionEnabled: false,
	emailToggles: [],
	formalLanguage: false,
	hasArchive: false,
	isDisplayNameEditable: true,
	isWalkThroughEnabled: false,
	languages: ['de', 'en'],
	preferredLanguage: 'de',
	userRoles: ['USER'],
	termsAndConditionsConfirmation: '',
	dataPrivacyConfirmation: '',
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
} as any;

export const consultingTypes = [
	{
		id: 1,
		showAskerProfile: true,
		isVideoCallAllowed: true,
		titles: {
			default: '1-1 Beratung',
			short: '1-1',
			long: '1-1 Beratung',
			welcome: 'Willkommen',
			registrationDropdown: '1-1 Beratung'
		}
	}
] as any;

export const storybookSettings = {
	useOverviewPage: false
} as any;

export function NavigationStoryProviders({
	role,
	children
}: {
	role: 'consultant' | 'asker';
	children: React.ReactNode;
}) {
	const userData = role === 'consultant' ? consultantUserData : askerUserData;

	/* Set before first child paint so useLiveChatViaSidebar() reads correctly. */
	const previousLiveChatKeys = useRef<
		| {
				availability: string | null;
				viaSidebar: string | null;
		  }
		| undefined
	>(undefined);
	if (previousLiveChatKeys.current === undefined) {
		try {
			previousLiveChatKeys.current = {
				availability: localStorage.getItem(
					'oriso_liveChatAvailability'
				),
				viaSidebar: localStorage.getItem('oriso_liveChatViaSidebar')
			};
			localStorage.removeItem('oriso_liveChatAvailability');
			localStorage.setItem('oriso_liveChatViaSidebar', '1');
		} catch {
			previousLiveChatKeys.current = {
				availability: null,
				viaSidebar: null
			};
		}
	}

	useEffect(() => {
		return () => {
			const previous = previousLiveChatKeys.current;
			if (!previous) {
				return;
			}
			try {
				if (previous.availability == null) {
					localStorage.removeItem('oriso_liveChatAvailability');
				} else {
					localStorage.setItem(
						'oriso_liveChatAvailability',
						previous.availability
					);
				}
				if (previous.viaSidebar == null) {
					localStorage.removeItem('oriso_liveChatViaSidebar');
				} else {
					localStorage.setItem(
						'oriso_liveChatViaSidebar',
						previous.viaSidebar
					);
				}
			} catch {
				/* Storybook cleanup only. */
			}
		};
	}, []);

	return (
		<UserDataContext.Provider
			value={{
				userData,
				setUserData: () => {},
				reloadUserData: async () => userData
			}}
		>
			<ConsultingTypesContext.Provider
				value={{
					consultingTypes,
					setConsultingTypes: () => {}
				}}
			>
				<SessionsDataContext.Provider
					value={{
						ready: true,
						sessions: [],
						dispatch: () => {}
					}}
				>
					<TenantContext.Provider
						value={{
							tenant: {
								id: 1,
								name: 'ORISO Storybook',
								settings: {
									featureToolsEnabled: false
								}
							} as any,
							setTenant: () => {}
						}}
					>
						<LocaleContext.Provider
							value={{
								locale: 'de',
								locales: ['de', 'en'],
								selectableLocales: ['de', 'en'],
								setLocale: () => {},
								initLocale: 'de'
							}}
						>
							{children}
						</LocaleContext.Provider>
					</TenantContext.Provider>
				</SessionsDataContext.Provider>
			</ConsultingTypesContext.Provider>
		</UserDataContext.Provider>
	);
}
