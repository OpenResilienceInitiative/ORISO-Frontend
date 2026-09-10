/**
 * The two call glyphs of a room header, lifted out of `SessionMenu.tsx`
 * unchanged so the supervision side room can show the SAME buttons as the
 * main chat (Frank, 09.09.2026) instead of a second set that only looks
 * similar. One definition, two callers.
 *
 * The fills are the ones the main chat has drawn since the call buttons
 * exist. They are inline SVG, so the m3Sweep guard (which reads .scss/.css)
 * does not see them; retinting them would change the main chat's look and is
 * a design decision of its own, not part of this move.
 */
import * as React from 'react';

export const VideoCallHeaderIcon = () => (
	<svg
		width="32"
		height="32"
		viewBox="0 0 32 32"
		fill="none"
		aria-hidden="true"
	>
		<rect width="32" height="32" rx="12" fill="#D32F2F" fillOpacity="0.6" />
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M18.3152 11.0601C18.9972 11.0601 19.5502 11.613 19.5502 12.295L19.55 14.7022L22.4928 11.7595C22.7822 11.4702 23.2514 11.4702 23.5407 11.7595C23.6797 11.8985 23.7578 12.087 23.7578 12.2835V19.7166C23.7578 20.1258 23.426 20.4575 23.0168 20.4575C22.8203 20.4575 22.6318 20.3795 22.4928 20.2405L19.55 17.2971L19.5502 19.705C19.5502 20.3871 18.9972 20.94 18.3152 20.94H9.47815C8.79609 20.94 8.24316 20.3871 8.24316 19.705V12.295C8.24316 11.613 8.79609 11.0601 9.47815 11.0601H18.3152Z"
			fill="white"
		/>
	</svg>
);

export const AudioCallHeaderIcon = () => (
	<svg
		width="32"
		height="32"
		viewBox="0 0 32 32"
		fill="none"
		aria-hidden="true"
	>
		<rect width="32" height="32" rx="16" fill="#FFD1D1" fillOpacity="0.6" />
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M22.7439 18.2098L19.8713 17.316C19.2285 17.1155 18.4628 17.4268 18.0513 18.0551C17.7168 18.5651 17.1871 18.9385 16.6341 19.0538C16.255 19.1326 15.8991 19.0798 15.6319 18.9054C14.4495 18.1327 13.4566 17.1427 12.6816 15.9644C12.5066 15.6977 12.4533 15.343 12.5327 14.9651C12.648 14.4139 13.0225 13.8858 13.5348 13.552C14.1643 13.1416 14.4761 12.3788 14.2756 11.7377L13.3789 8.87442C13.1807 8.23973 12.5344 7.88558 11.8423 8.03338L9.08566 8.61996C9.02712 8.63214 8.96858 8.64779 8.91062 8.66749L8.79585 8.7098C8.76107 8.7243 8.72514 8.74168 8.68804 8.76197C8.26782 8.9915 7.99771 9.43607 8.00001 9.89455C8.00351 10.4927 8.04002 11.0903 8.10842 11.6723L8.08349 11.8722L8.08407 11.8734L8.14146 11.9308C8.55357 14.9802 9.84671 17.6627 11.887 19.6972C13.9707 21.7745 16.7309 23.074 19.8707 23.4565C20.4706 23.5296 21.0879 23.5684 21.7052 23.5725C21.7075 23.5725 21.7099 23.5725 21.7127 23.5725C22.184 23.5725 22.6482 23.2874 22.8708 22.8595C22.8853 22.8306 22.8987 22.8028 22.9097 22.7761C22.9485 22.6828 22.9787 22.5859 22.9989 22.4909L23.5872 19.7412C23.7345 19.0514 23.3797 18.4075 22.7439 18.2098Z"
			fill="#CC1E1C"
			fillOpacity="0.6"
		/>
	</svg>
);
