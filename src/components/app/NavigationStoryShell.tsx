import * as React from 'react';
import { useMemo } from 'react';
import { NavigationBar } from './NavigationBar';
import { RouterConfigConsultant, RouterConfigUser } from './RouterConfig';
import { config } from '../../resources/scripts/config';
import {
	NavigationStoryProviders,
	storybookSettings
} from './navigationStoryHelpers';
import './navigation.styles.scss';
import './authenticatedApp.styles.scss';

/** Shared production menu and required app scope for isolated Storybook fixtures. */
export function NavigationStoryShell({
	role,
	liveChatViaSidebar = true,
	hasAssignedConsultant = false,
	tenantSettings,
	appointmentFeatureEnabled,
	languageOptions,
	onLogout,
	displayEntry,
	className = '',
	children,
	...shellProps
}: Omit<React.HTMLAttributes<HTMLDivElement>, 'role'> & {
	role: 'consultant' | 'asker';
	liveChatViaSidebar?: boolean;
	/** Show the advice seeker's calendar once a counsellor is assigned. */
	hasAssignedConsultant?: boolean;
	/** Träger settings for the story tenant. */
	tenantSettings?: Record<string, unknown>;
	/** Shows the "Meine Termine" rail entry. */
	appointmentFeatureEnabled?: boolean;
	languageOptions?: string[];
	onLogout: () => void;
	displayEntry?: React.ReactNode;
}) {
	const routerConfig = useMemo(() => {
		const settings = { ...config, ...storybookSettings };
		return role === 'consultant'
			? RouterConfigConsultant(settings)
			: RouterConfigUser(settings, hasAssignedConsultant);
	}, [role, hasAssignedConsultant]);

	return (
		<NavigationStoryProviders
			role={role}
			liveChatViaSidebar={liveChatViaSidebar}
			tenantSettings={tenantSettings}
			appointmentFeatureEnabled={appointmentFeatureEnabled}
			languageOptions={languageOptions}
		>
			<div {...shellProps} className={`app__wrapper ${className}`}>
				{children}
				<NavigationBar
					routerConfig={routerConfig}
					onLogout={onLogout}
					displayEntry={displayEntry}
				/>
			</div>
		</NavigationStoryProviders>
	);
}
