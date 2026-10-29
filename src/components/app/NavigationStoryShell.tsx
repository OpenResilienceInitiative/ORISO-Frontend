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
	onLogout,
	className = '',
	children,
	...shellProps
}: Omit<React.HTMLAttributes<HTMLDivElement>, 'role'> & {
	role: 'consultant' | 'asker';
	liveChatViaSidebar?: boolean;
	onLogout: () => void;
}) {
	const routerConfig = useMemo(() => {
		const settings = { ...config, ...storybookSettings };
		return role === 'consultant'
			? RouterConfigConsultant(settings)
			: RouterConfigUser(settings, false);
	}, [role]);

	return (
		<NavigationStoryProviders
			role={role}
			liveChatViaSidebar={liveChatViaSidebar}
		>
			<div {...shellProps} className={`app__wrapper ${className}`}>
				{children}
				<NavigationBar
					routerConfig={routerConfig}
					onLogout={onLogout}
				/>
			</div>
		</NavigationStoryProviders>
	);
}
