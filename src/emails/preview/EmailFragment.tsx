import * as React from 'react';
import {
	EMAIL_PREVIEW_WIDTHS,
	EmailPreview,
	EmailPreviewWidth,
	wrapEmailFragment
} from './EmailPreview';

/**
 * Story host for a single atom, molecule or organism.
 *
 * Takes the raw markup a kit function returns and puts it inside a real e-mail
 * document, so what a story shows is exactly what a mail client would get.
 */
export interface EmailFragmentProps {
	/** Markup from a kit function. */
	fragment: string;
	/** `true` when the fragment is one or more `<tr>` rows. */
	rows?: boolean;
	/** Place the fragment on the white card rather than the bare canvas. */
	onCard?: boolean;
	/** Simulated viewport width — the mobile media query reacts to this. */
	width?: EmailPreviewWidth;
	/** Replace `{{placeholders}}` with sample data. */
	filled?: boolean;
}

export const EmailFragment: React.FC<EmailFragmentProps> = ({
	fragment,
	rows = true,
	onCard = true,
	width = 700,
	filled = true
}) => (
	<EmailPreview
		html={wrapEmailFragment(fragment, { rows, onCard })}
		width={width}
		filled={filled}
	/>
);

/** Shared controls: every fragment story can be resized and un-filled. */
export const emailFragmentArgTypes = {
	width: {
		name: 'Viewport',
		control: { type: 'select' as const },
		options: Object.values(EMAIL_PREVIEW_WIDTHS),
		labels: Object.fromEntries(
			Object.entries(EMAIL_PREVIEW_WIDTHS).map(([label, value]) => [
				value,
				label
			])
		)
	},
	filled: { name: 'Sample data', control: { type: 'boolean' as const } },
	onCard: { name: 'On the card', control: { type: 'boolean' as const } },
	rows: { table: { disable: true } },
	fragment: { table: { disable: true } }
};
