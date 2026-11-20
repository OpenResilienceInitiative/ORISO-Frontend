import React, { ReactElement } from 'react';
import './scrollableSection.styles.scss';

type ScrollableSectionProps = {
	children: ReactElement[];
	offset?: number;
	/** Remount only the body when its content changes, resetting scroll while chrome and focus remain. */
	bodyKey?: string | number;
};

export const ScrollableSection = ({
	children,
	bodyKey
}: ScrollableSectionProps) => {
	return (
		<div className="scrollableSection">
			{children.length >= 2 && (
				<div className="scrollableSection__header">{children[0]}</div>
			)}
			<div key={bodyKey} className="scrollableSection__body">
				{children.length === 1 ? children[0] : children[1]}
			</div>
			{children.length === 3 && (
				<div className="scrollableSection__footer">{children[2]}</div>
			)}
		</div>
	);
};
