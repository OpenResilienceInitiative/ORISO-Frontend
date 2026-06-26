import * as React from 'react';
import { useEffect, useState } from 'react';
import { EmptyStateAnimation } from './EmptyStateAnimation';

export const SearchEmptyStateAnimation = () => {
	const [animationData, setAnimationData] = useState<Record<
		string,
		any
	> | null>(null);

	useEffect(() => {
		let mounted = true;

		import('../../resources/animations/emptyStates/search.json').then(
			(module) => {
				if (mounted) {
					setAnimationData(module.default ?? module);
				}
			}
		);

		return () => {
			mounted = false;
		};
	}, []);

	if (!animationData) {
		return (
			<div
				aria-hidden="true"
				className="emptyState__animation"
				data-cy="empty-state-animation"
				data-empty-state="search"
			/>
		);
	}

	return (
		<EmptyStateAnimation
			animationData={animationData}
			speed={0.8}
			variant="search"
		/>
	);
};
