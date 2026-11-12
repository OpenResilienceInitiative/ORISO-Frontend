import * as React from 'react';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ReactComponent as BlurIcon } from '../../resources/img/icons/blur_400.svg';

export interface PassageBlurBarProps {
	/** Inline position inside the selection layer. */
	style?: React.CSSProperties;
	/** Who blurred the passage, when known. */
	blurredBy?: string;
	onRemove: () => void;
}

/**
 * The bar a moderator gets on a blurred passage: who blurred it, and
 * "Remove blur". Same card as the selection toolbar.
 */
export const PassageBlurBar = forwardRef<HTMLDivElement, PassageBlurBarProps>(
	({ style, blurredBy, onRemove }, ref) => {
		const { t: translate } = useTranslation();
		return (
			<div
				ref={ref}
				role="toolbar"
				aria-label={translate('message.selectionReply.blurBar')}
				className="selectionReply__toolbar"
				data-cy="passage-blur-bar"
				style={style}
				onMouseDown={(event) => event.preventDefault()}
			>
				{/* On a phone the bar keeps only the action. */}
				{blurredBy && (
					<span className="selectionReply__wideLabel">
						<span className="selectionReply__blurredBy">
							{translate('message.selectionReply.blurredBy', {
								name: blurredBy
							})}
						</span>
						<span
							className="selectionReply__toolbarDivider"
							aria-hidden
						/>
					</span>
				)}
				<button
					type="button"
					className="selectionReply__toolbarButton"
					data-cy="passage-blur-remove"
					onClick={onRemove}
				>
					<BlurIcon
						aria-hidden
						className="selectionReply__blurIcon"
					/>
					<span>
						{translate('message.selectionReply.removeBlur')}
					</span>
				</button>
			</div>
		);
	}
);

PassageBlurBar.displayName = 'PassageBlurBar';
