import * as React from 'react';

export type FilterSlidersIconProps = {
	className?: string;
};

/** Two-slider filter glyph of the display-filter button (Frank 2026-09-21). */
export const FilterSlidersIcon = ({ className }: FilterSlidersIconProps) => (
	<svg
		width={24}
		height={24}
		viewBox="0 0 100 100"
		fill="currentColor"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden
		className={className}
	>
		<g fillRule="evenodd">
			<path d="m37.5 20.832c-4.6016 0-8.332 3.7305-8.332 8.3359 0 4.6016 3.7305 8.332 8.332 8.332s8.332-3.7305 8.332-8.332c0-4.6055-3.7305-8.3359-8.332-8.3359zm-16.668 8.3359c0-9.207 7.4648-16.668 16.668-16.668s16.668 7.4609 16.668 16.668c0 9.2031-7.4648 16.664-16.668 16.664s-16.668-7.4609-16.668-16.664z" />
			<path d="m25 33.332h-12.5v-8.332h12.5z" />
			<path d="m87.5 75h-12.5v-8.332h12.5z" />
			<path d="m37.5 75h-25v-8.332h25z" />
			<path d="m87.5 33.332h-25v-8.332h25z" />
			<path d="m62.5 62.5c-4.6016 0-8.332 3.7305-8.332 8.332 0 4.6055 3.7305 8.3359 8.332 8.3359s8.332-3.7305 8.332-8.3359c0-4.6016-3.7305-8.332-8.332-8.332zm-16.668 8.332c0-9.2031 7.4648-16.664 16.668-16.664s16.668 7.4609 16.668 16.664c0 9.207-7.4648 16.668-16.668 16.668s-16.668-7.4609-16.668-16.668z" />
		</g>
	</svg>
);
