import React, { useEffect, useRef, useState } from 'react';
import './fittedHeaderTitle.styles.scss';

/** Keep a single-line room title readable before falling back to ellipsis. */
export const FittedHeaderTitle = ({
	children,
	...props
}: React.HTMLAttributes<HTMLHeadingElement> & { children: string }) => {
	const headingRef = useRef<HTMLHeadingElement>(null);
	const measureRef = useRef<HTMLSpanElement>(null);
	const [fontSize, setFontSize] = useState<number>();

	useEffect(() => {
		const heading = headingRef.current;
		const measure = measureRef.current;
		if (!heading || !measure) return undefined;
		let frame = 0;
		let active = true;
		const update = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				if (!active) return;
				const available = heading.clientWidth;
				const headingStyle = getComputedStyle(heading);
				for (const property of [
					'fontFamily',
					'fontWeight',
					'fontSize',
					'fontStyle',
					'fontStretch',
					'letterSpacing'
				] as const) {
					if (measure.style[property] !== headingStyle[property])
						measure.style[property] = headingStyle[property];
				}
				const natural = measure.getBoundingClientRect().width;
				const base = parseFloat(headingStyle.fontSize);
				if (!available || !natural || !Number.isFinite(base)) return;
				// 16 px is the lower readability bound; any remaining overflow is ellipsised.
				const fitted =
					Math.floor(
						Math.min(
							base,
							Math.max(
								Math.min(16, base),
								(base * available) / natural
							)
						) * 100
					) / 100;
				setFontSize(fitted);
			});
		};
		const observer = new ResizeObserver(update);
		observer.observe(heading);
		observer.observe(measure);
		window.addEventListener('resize', update);
		if (document.fonts) void document.fonts.ready.then(update);
		update();
		return () => {
			active = false;
			cancelAnimationFrame(frame);
			observer.disconnect();
			window.removeEventListener('resize', update);
		};
	}, [children]);

	return (
		<>
			<h3 {...props} ref={headingRef} title={props.title ?? children}>
				<span className="fittedHeaderTitle__text" style={{ fontSize }}>
					{children}
				</span>
			</h3>
			<span
				ref={measureRef}
				aria-hidden="true"
				className="fittedHeaderTitle__measure"
				data-title={children}
			/>
		</>
	);
};
