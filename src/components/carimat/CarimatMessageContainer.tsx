import * as React from 'react';
import './CarimatMessageContainer.styles.scss';

/** Structured system messages share a measure determined by their chat column. */
export const CarimatMessageContainer = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className = '', children, ...props }, ref) => (
	<div className="carimatMessageHost">
		<div
			{...props}
			ref={ref}
			className={`carimatMessageContainer ${className}`}
		>
			{children}
		</div>
	</div>
));
CarimatMessageContainer.displayName = 'CarimatMessageContainer';
