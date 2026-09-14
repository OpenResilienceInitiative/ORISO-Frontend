import * as React from 'react';
import './m3Checkbox.styles.scss';

/**
 * Material 3 checkbox (#576 design review — the raw accent-color inputs were
 * not M3). Real <input> for a11y/keyboard, drawn per M3 spec: 18dp container,
 * 2dp rounded corners, primary fill + on-primary check when selected, 40dp
 * state layer on hover/focus.
 */
export const M3Checkbox = ({
	checked,
	onChange,
	label,
	dataCy,
	disabled = false,
	hideLabel = false
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label: string;
	dataCy?: string;
	/** M3 disabled state: 38% opacity, no state layer, input inert. */
	disabled?: boolean;
	/** Keep the label for assistive tech only (table cells with a column header). */
	hideLabel?: boolean;
}) => (
	<label className={`m3Checkbox${disabled ? ' m3Checkbox--disabled' : ''}`}>
		<span className="m3Checkbox__target">
			<input
				type="checkbox"
				className="m3Checkbox__input"
				checked={checked}
				disabled={disabled}
				aria-label={hideLabel ? label : undefined}
				onChange={(e) => onChange(e.target.checked)}
				data-cy={dataCy}
			/>
			<span className="m3Checkbox__box" aria-hidden="true">
				<svg viewBox="0 0 18 18" className="m3Checkbox__check">
					<path
						d="M7 13.2 3.5 9.7l1.4-1.4L7 10.4l6.1-6.1 1.4 1.4z"
						fill="currentColor"
					/>
				</svg>
			</span>
		</span>
		{!hideLabel && <span className="m3Checkbox__label">{label}</span>}
	</label>
);
