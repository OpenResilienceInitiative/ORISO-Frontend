import * as React from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiUrl } from '../resources/scripts/endpoints';
import {
	AddonApp,
	AddonHostProps,
	AddonModule,
	AddonSlot,
	AvailableAddon
} from './addonTypes';
import { loadAddonModule } from './loadAddonModule';
import { AddonPlacement, useAddonHostProps } from './useAddonHostProps';

const bootstrapped = new WeakSet<AddonModule>();

type AddonModuleLoader = (url: string) => Promise<AddonModule>;

/** Replaced in Storybook, where no AddonService serves bundles. */
export const AddonModuleLoaderContext =
	createContext<AddonModuleLoader>(loadAddonModule);

interface AddonMountProps {
	addon: AvailableAddon;
	app: AddonApp;
	slot: AddonSlot;
	placement?: AddonPlacement;
	/** Injected in tests; defaults to the loader from context. */
	loader?: AddonModuleLoader;
}

/** Loads an add-on bundle and mounts one of its apps into a slot. */
export const AddonMount = ({
	addon,
	app,
	slot,
	placement,
	loader: loaderProp
}: AddonMountProps) => {
	const contextLoader = useContext(AddonModuleLoaderContext);
	const loader = loaderProp ?? contextLoader;
	const { t: translate } = useTranslation();
	const element = useRef<HTMLDivElement>(null);
	const [failed, setFailed] = useState(false);
	const hostProps = useAddonHostProps(addon, app, slot, placement);

	useEffect(() => {
		const domElement = element.current;
		if (!domElement) {
			return undefined;
		}
		let active = true;
		let mounted: { module: AddonModule; props: AddonHostProps } | null =
			null;
		setFailed(false);

		(async () => {
			try {
				const module = await loader(`${apiUrl}${addon.entry}`);
				const props: AddonHostProps = { ...hostProps, domElement };
				if (!bootstrapped.has(module)) {
					await module.bootstrap?.(props);
					bootstrapped.add(module);
				}
				if (!active) {
					return;
				}
				await module.mount(props);
				mounted = { module, props };
				if (!active) {
					await module.unmount(props);
				}
			} catch (error) {
				console.error(`Add-on ${addon.name}/${app.id} failed`, error);
				if (active) {
					setFailed(true);
				}
			}
		})();

		return () => {
			active = false;
			if (mounted) {
				const { module, props } = mounted;
				// Deferred: an add-on may unmount its own React root, which React refuses during a commit.
				Promise.resolve()
					.then(() => module.unmount(props))
					.catch((error) =>
						console.error(
							`Add-on ${addon.name}/${app.id} failed to unmount`,
							error
						)
					);
			}
		};
	}, [addon, app.id, hostProps, loader]);

	return (
		<div
			className="addonMount"
			data-addon={addon.name}
			data-addon-app={app.id}
			data-addon-slot={slot}
		>
			{failed && (
				<p className="addonMount__error" role="alert">
					{translate('addons.loadError')}
				</p>
			)}
			<div ref={element} />
		</div>
	);
};
