import * as React from 'react';
import {
	SESSION_CARD_GEOMETRY,
	SessionCardGeometry,
	sessionCardBodyHeight,
	sessionCardShapeOutside
} from './sessionCardGeometry';
import { useReservedTrailingWidth } from './useReservedTrailingWidth';
import './sessionCardBody.styles.scss';

export interface SessionCardBodyProps {
	/** Drawn level with the name; the preview flows around it. */
	avatar: React.ReactNode;
	name: React.ReactNode;
	/** Clamped to `previewLines` lines with an ellipsis. */
	preview?: React.ReactNode;
	/** Takes the preview's place (case handover, Figma 115). */
	action?: React.ReactNode;
	/** Marks on the last line, ending under the menu pill (Mail …). */
	trailing?: React.ReactNode;
	geometry?: SessionCardGeometry;
}

/**
 * The body of a session card under its chip row (Frank, 15.–17.09.2026).
 * It owns the geometry only; the list item fills the slots.
 *
 * Storybook: https://dev.oriso.org/storybook-frontend/?path=/story/components-session-list-sessioncardbody--all-previews
 */
export const SessionCardBody = ({
	avatar,
	name,
	preview,
	action,
	trailing,
	geometry = SESSION_CARD_GEOMETRY
}: SessionCardBodyProps) => {
	const { bodyRef, trailingRef } = useReservedTrailingWidth();
	const style = {
		'--card-avatar': `${geometry.avatar}px`,
		'--card-gap': `${geometry.gap}px`,
		'--card-name-line': `${geometry.nameLine}px`,
		'--card-preview-line': `${geometry.previewLine}px`,
		'--card-preview-lines': geometry.previewLines,
		'--card-inset': `${geometry.inset}px`,
		'--card-mark': `${geometry.mark}px`,
		'--card-trailing-clearance': `${geometry.trailingClearance}px`,
		'--card-body': `${sessionCardBodyHeight(geometry)}px`
	} as React.CSSProperties;

	return (
		<div className="sessionCard" ref={bodyRef} style={style}>
			<div className="sessionCard__name">{name}</div>
			<div className="sessionCard__flow">
				<div className="sessionCard__flowInner">
					<div
						className="sessionCard__avatar"
						style={{
							shapeOutside: sessionCardShapeOutside(geometry)
						}}
					>
						{avatar}
					</div>
					<div className="sessionCard__spacer" aria-hidden="true" />
					<div className="sessionCard__reserve" aria-hidden="true" />
					<div className="sessionCard__preview">{preview}</div>
				</div>
			</div>
			{action && <div className="sessionCard__action">{action}</div>}
			<div className="sessionCard__trailing" ref={trailingRef}>
				{trailing}
			</div>
		</div>
	);
};
