import clsx from 'clsx';
import * as React from 'react';

import { Stage } from '../stage/stage';
import './legalPageWrapper.styles.scss';
import { LegalContentRenderer } from '../legalContent/LegalContentRenderer';

export interface LegalPageWrapperProps {
	className?: string;
	content: string;
}
export const LegalPageWrapper = ({
	className,
	content
}: LegalPageWrapperProps) => {
	return (
		<div className={clsx('legalPageWrapper stageLayout', className)}>
			<Stage className="stageLayout__stage" />
			<div className={clsx('stageLayout__content', className)}>
				<section className="template">
					{/* Resolves multilingual legal content (language map with
					    optional machine-translation markers) to the UI
					    language; plain HTML passes through unchanged. */}
					{typeof content === 'string' && (
						<LegalContentRenderer content={content} />
					)}
				</section>
			</div>
		</div>
	);
};
