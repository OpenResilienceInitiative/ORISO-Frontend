export type ServerAppConfigInterface = {
	[key: string]: ServerAppConfigValueInterface;
} & ServerAppConfigCustomInterface;

interface ServerAppConfigCustomInterface {
	mainTenantSubdomainForSingleDomainMultitenancy?: ServerAppConfigValueInterface<string>;
	supportEmail?: ServerAppConfigValueInterface<string>;
	chatComposerDisabledFormats?: ServerAppConfigValueInterface<string>;
	chatMessageMaxWidthDesktop?: ServerAppConfigValueInterface<string>;
	chatMessageCollapseThreshold?: ServerAppConfigValueInterface<string>;
	releaseToggles: Record<string, string>;
}

interface ServerAppConfigValueInterface<T = boolean> {
	value: T;
	readOnly: boolean;
}
