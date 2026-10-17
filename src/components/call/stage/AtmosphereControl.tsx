import * as React from 'react';

import { StageControlButton } from '../atoms/StageControlButton';
import { Atmosphere, type AtmosphereName } from '../atmosphere/Atmosphere';
import { ReactComponent as ImageFilledIcon } from '../../../resources/img/icons/image-filled.svg';
import type { CentreImage } from './StageBackdrop';
import styles from './atmosphereControl.module.scss';

export interface AtmosphereControlProps {
	/** Tooltip and accessible name. The prototype's is "Atmosphäre wählen". */
	readonly label: string;
	readonly atmosphere: AtmosphereName;
	/** When the centre has configured its own backdrop. */
	readonly image?: CentreImage | null;
	readonly onClick: () => void;
	readonly expanded?: boolean;
}

/**
 * The header's backdrop control, ticket 05.
 *
 * A 44px icon-only button with a tooltip, as the ticket asks — but the
 * prototype is more specific than the ticket and the difference is worth
 * keeping. The control does not show a picture OF the backdrop; with a
 * preset it shows the backdrop, a 30px round pond running the same palette
 * the stage is running. Pressing it changes exactly the thing it is
 * displaying.
 *
 * Once the centre has uploaded its own image, that breaks down: a
 * photograph at 30px is mud. The design falls back to a glyph on a grey
 * disc rather than a thumbnail nobody can read, and so does this.
 */
export const AtmosphereControl = ({
	label,
	atmosphere,
	image,
	onClick,
	expanded
}: AtmosphereControlProps) => (
	<StageControlButton
		label={label}
		onClick={onClick}
		expanded={expanded}
		icon={
			image ? (
				<span
					className={styles.disc}
					data-testid="atmosphere-control-image"
				>
					<ImageFilledIcon />
				</span>
			) : (
				<span className={styles.preview}>
					<Atmosphere palette={atmosphere} />
				</span>
			)
		}
	/>
);
