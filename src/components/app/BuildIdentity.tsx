import * as React from 'react';
import { createPortal } from 'react-dom';
import {
	getBuildCommit,
	getPlatformVersion
} from '../../resources/scripts/runtimeConfig';
import { Text } from '../text/Text';

// The shell owns one identity. A nested stage supplies its normal-flow footer
// as the placement, instead of leaving the fixed shell label behind its bar.
const BuildIdentityOwnerContext = React.createContext<{
	setStageTarget: React.RefCallback<HTMLDivElement>;
} | null>(null);

export const useBuildIdentityOwner = () =>
	React.useContext(BuildIdentityOwnerContext);

/** The shell keeps its identity while routes load, fail or render a stage. */
export const AuthenticatedBuildIdentityBoundary = ({
	children
}: {
	children: React.ReactNode;
}) => {
	const [stageTarget, setStageTarget] = React.useState<HTMLDivElement | null>(
		null
	);
	const owner = React.useMemo(() => ({ setStageTarget }), []);
	return (
		<BuildIdentityOwnerContext.Provider value={owner}>
			{children}
			{stageTarget ? (
				createPortal(<BuildIdentity variant="stage" />, stageTarget)
			) : (
				<BuildIdentity variant="authenticated" />
			)}
		</BuildIdentityOwnerContext.Provider>
	);
};

/** Same identity contract in the existing public and authenticated renderers. */
export const BuildIdentity = ({
	variant
}: {
	variant: 'stage' | 'authenticated';
}) => {
	const release = getPlatformVersion();
	const commit = getBuildCommit();
	if (!release && !commit) return null;
	const identity = (
		<span
			data-testid="build-identity"
			data-platform-version={release}
			data-build-commit={commit ?? ''}
		>
			{[release, commit?.slice(0, 7) ?? 'unknown']
				.filter(Boolean)
				.join(' - ')}
		</span>
	);
	return variant === 'stage' ? (
		<Text className="stageLayout__platformVersion" type="infoSmall">
			{identity}
		</Text>
	) : (
		<div className="app__platformVersion">{identity}</div>
	);
};
