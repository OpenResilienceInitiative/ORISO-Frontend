import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';

interface ResizableHandleProps {
	onResize: (width: number) => void;
	minWidth?: number;
	maxWidth?: number;
}

export const ResizableHandle: React.FC<ResizableHandleProps> = ({
	onResize,
	minWidth = 80,
	maxWidth = 600
}) => {
	const ICON_ONLY_THRESHOLD = 420;
	const SNAP_THRESHOLD = 360;
	const [isDragging, setIsDragging] = useState(false);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDragging) return;

			let newWidth = Math.min(Math.max(e.clientX, minWidth), maxWidth);

			// Snap out of the "broken/truncated" mid-range earlier.
			if (newWidth > minWidth && newWidth < ICON_ONLY_THRESHOLD) {
				// If we're in the awkward range, decide whether to snap to min or normal
				if (newWidth < SNAP_THRESHOLD) {
					newWidth = minWidth; // Snap to icon-only mode (smooth)
				} else {
					newWidth = ICON_ONLY_THRESHOLD; // Snap to safe minimum width
				}
			}

			onResize(newWidth);
		},
		[isDragging, onResize, minWidth, maxWidth]
	);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	useEffect(() => {
		if (isDragging) {
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			document.body.style.cursor = 'col-resize';
			document.body.style.userSelect = 'none';

			return () => {
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
				document.body.style.cursor = '';
				document.body.style.userSelect = '';
			};
		}
	}, [isDragging, handleMouseMove, handleMouseUp]);

	return (
		<div
			className="sessionsList__resizeHandle"
			onMouseDown={handleMouseDown}
			style={{
				position: 'absolute',
				right: '-2px',
				top: 0,
				bottom: 0,
				width: '2px', // Wider for easier grabbing
				cursor: 'col-resize',
				backgroundColor: isDragging
					? 'rgba(0, 0, 0, 0)'
					: 'rgba(0, 0, 0, 0)',
				transition: isDragging ? 'none' : 'background-color 0.15s ease',
				zIndex: 10,
				opacity: isDragging ? 0.8 : 0.8
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.backgroundColor = 'rgba(80, 80, 80, 0.2)';
			}}
			onMouseLeave={(e) => {
				if (!isDragging) {
					e.currentTarget.style.backgroundColor =
						'rgba(80, 80, 80, 0.1)';
				}
			}}
		/>
	);
};
