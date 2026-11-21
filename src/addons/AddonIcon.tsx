import * as React from 'react';
import {
	createContext,
	useContext,
	useEffect,
	useSyncExternalStore
} from 'react';
import clsx from 'clsx';
import { apiUrl } from '../resources/scripts/endpoints';
import { ReactComponent as ToolsIconOutline } from '../resources/img/icons/tools_outline.svg';
import './addons.styles';

/** As the AddonService gives it: an SVG under the add-on's own `/ui/` route. */
const ICON_PATH =
	/^\/service\/addons\/[A-Za-z0-9._-]+\/ui\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.svg$/;

/** Where icon paths are loaded from; replaced in Storybook, which serves them itself. */
export const AddonIconBaseContext = createContext<string>(apiUrl);

export const addonIconUrl = (
	icon: string | undefined,
	baseUrl: string = apiUrl
): string | null =>
	icon && icon.length <= 300 && ICON_PATH.test(icon) && !icon.includes('..')
		? `${baseUrl}${icon}`
		: null;

type IconStatus = 'loading' | 'ready' | 'failed';
const statuses = new Map<string, IconStatus>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

const probe = (url: string) => {
	if (statuses.has(url) || typeof Image === 'undefined') {
		return;
	}
	statuses.set(url, 'loading');
	const image = new Image();
	const settle = (status: IconStatus) => {
		statuses.set(url, status);
		listeners.forEach((listener) => listener());
	};
	image.onload = () => settle('ready');
	image.onerror = () => settle('failed');
	image.src = url;
};

export const resetAddonIconsForTests = () => statuses.clear();

const useIconStatus = (url: string | null): IconStatus => {
	useEffect(() => {
		if (url) {
			probe(url);
		}
	}, [url]);
	return useSyncExternalStore(
		subscribe,
		() => (url ? (statuses.get(url) ?? 'loading') : 'failed'),
		() => 'loading'
	);
};

interface AddonIconProps {
	icon?: string;
	className?: string;
	/** Shown without an icon or when it does not load. */
	fallback?: React.ReactNode;
}

/**
 * An add-on app's icon as a CSS mask in `currentColor`, so it takes the theme and the active
 * state of where it sits; the default tools icon without one.
 */
export const AddonIcon = ({ icon, className, fallback }: AddonIconProps) => {
	const url = addonIconUrl(icon, useContext(AddonIconBaseContext));
	const status = useIconStatus(url);
	if (!url || status === 'failed') {
		return (
			<>
				{fallback ?? (
					<ToolsIconOutline
						aria-hidden="true"
						className={className}
					/>
				)}
			</>
		);
	}
	return (
		<span
			aria-hidden="true"
			className={clsx('addonIcon', className)}
			data-addon-icon={icon}
			style={{ '--addon-icon': `url("${url}")` } as React.CSSProperties}
		/>
	);
};

const navigationIcons = new Map<string, React.ComponentType<NavIconProps>>();

interface NavIconProps {
	'className'?: string;
	'title'?: string;
	'aria-label'?: string;
}

/** A component in the shape the navigation renders its icons with; one per icon, so it stays stable. */
export const addonNavigationIcon = (icon: string) => {
	let component = navigationIcons.get(icon);
	if (!component) {
		const NavigationIcon = ({ className }: NavIconProps) => (
			<AddonIcon
				icon={icon}
				className={className}
				fallback={
					<ToolsIconOutline
						aria-hidden="true"
						className={className}
					/>
				}
			/>
		);
		component = NavigationIcon;
		navigationIcons.set(icon, component);
	}
	return component;
};
