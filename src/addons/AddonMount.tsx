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

const bootstraps = new WeakMap<AddonModule, Promise<void>>();

/** Runs a bundle's `bootstrap` once, however many apps of it mount at the same time. */
export const bootstrapOnce = (module: AddonModule, props: AddonHostProps) => {
	let bootstrap = bootstraps.get(module);
	if (!bootstrap) {
		bootstrap = Promise.resolve(module.bootstrap?.(props)).catch(
			(error) => {
				bootstraps.delete(module);
				throw error;
			}
		);
		bootstraps.set(module, bootstrap);
	}
	return bootstrap;
};

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

interface MountedApp {
	module: AddonModule;
	props: AddonHostProps;
	hostProps: Omit<AddonHostProps, 'domElement'>;
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
	const hostPropsRef = useRef(hostProps);
	hostPropsRef.current = hostProps;
	const mountedRef = useRef<MountedApp | null>(null);
	// Every lifecycle call of this container waits for the previous one.
	const lifecycle = useRef<Promise<void>>(Promise.resolve());
	const label = `${addon.name}/${app.id}`;

	const enqueue = (step: () => Promise<void>) => {
		lifecycle.current = lifecycle.current.then(step).catch((error) => {
			console.error(`Add-on ${label} failed`, error);
		});
	};

	useEffect(() => {
		const domElement = element.current;
		if (!domElement) {
			return undefined;
		}
		let active = true;
		let mounted: MountedApp | null = null;
		setFailed(false);

		enqueue(async () => {
			if (!active) {
				return;
			}
			try {
				const module = await loader(`${apiUrl}${addon.entry}`);
				const current = hostPropsRef.current;
				const props: AddonHostProps = { ...current, domElement };
				await bootstrapOnce(module, props);
				if (!active) {
					return;
				}
				await module.mount(props);
				mounted = { module, props, hostProps: current };
				mountedRef.current = mounted;
			} catch (error) {
				console.error(`Add-on ${label} failed`, error);
				if (active) {
					setFailed(true);
				}
			}
		});

		return () => {
			active = false;
			// Runs after the commit: an add-on may unmount its own React root, which React refuses during one.
			enqueue(async () => {
				if (!mounted) {
					return;
				}
				if (mountedRef.current === mounted) {
					mountedRef.current = null;
				}
				await mounted.module.unmount(mounted.props);
			});
		};
		// Host props reach a mounted app through `update` below, so a new registry snapshot does not remount it.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [addon.name, addon.entry, app.id, slot, loader]);

	useEffect(() => {
		enqueue(async () => {
			const mounted = mountedRef.current;
			if (!mounted || mounted.hostProps === hostProps) {
				return;
			}
			const props: AddonHostProps = {
				...hostProps,
				domElement: mounted.props.domElement
			};
			if (mounted.module.update) {
				await mounted.module.update(props);
			} else {
				await mounted.module.unmount(mounted.props);
				await mounted.module.mount(props);
			}
			mounted.props = props;
			mounted.hostProps = hostProps;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hostProps]);

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
