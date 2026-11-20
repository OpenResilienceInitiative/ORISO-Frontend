import * as React from 'react';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';

export interface ComposerContextBarProps {
	/** Which relation the next send carries. Also names the legacy class hooks. */
	kind: 'reply' | 'edit';
	/** The emphasized lead: the quoted author, or the "editing" label. */
	lead: React.ReactNode;
	/** The quoted message, on one ellipsized line. */
	quote: React.ReactNode;
	/** Already translated. What the X does: "discard reply", "cancel edit". */
	cancelLabel: string;
	onCancel?: () => void;
	/** Already translated. Full sentence for a screen reader, when the lead alone is too terse. */
	statusLabel?: string;
}

/**
 * Figma "Reply Bar_v2" (9354:206458 desktop, 18:6713 mobile): the one bar that
 * says what the next message refers to. A cancel glyph on the left, then the
 * lead and the quote on a single line, so a reply and an edit can never drift
 * into two different looks again.
 */
export const ComposerContextBar = ({
	kind,
	lead,
	quote,
	cancelLabel,
	onCancel,
	statusLabel
}: ComposerContextBarProps) => (
	<div
		className={`messageSubmit__contextBar messageSubmit__${kind}Preview`}
		role="status"
		aria-label={statusLabel}
	>
		<button
			type="button"
			className={`messageSubmit__contextBarCancel messageSubmit__${kind}PreviewCancel`}
			onClick={() => onCancel && onCancel()}
			aria-label={cancelLabel}
			title={cancelLabel}
		>
			<HighlightOffIcon fontSize="inherit" />
		</button>
		<span
			className={`messageSubmit__contextBarText messageSubmit__${kind}PreviewText`}
		>
			<span
				className={`messageSubmit__contextBarLead messageSubmit__${kind}PreviewLabel`}
			>
				{lead}
			</span>{' '}
			<span
				className={`messageSubmit__contextBarQuote messageSubmit__${kind}PreviewQuote`}
			>
				{quote}
			</span>
		</span>
	</div>
);
