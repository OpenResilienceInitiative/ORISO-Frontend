import * as React from 'react';
import './ErstantwortImageSlot.styles.scss';

/**
 * The reserved **square** picture area of the Erfolgsnachricht (Modul 1).
 *
 * <h3>Why square, and why reserved rather than drawn</h3>
 *
 * Frank's instruction of 2026-09-07 (evening): he adapts his illustration to
 * **at most square**, so the layout has to hold a 1:1 area — not a banner, not
 * a strip. Reserving the wrong aspect ratio is the one mistake that cannot be
 * fixed by swapping the file later: a 16:9 slot given a square drawing either
 * crops it or leaves two empty columns, and both are decided *here*, months
 * before the artwork exists.
 *
 * Nothing is drawn. The slot is dashed and captioned, exactly like the step
 * illustration slot in Modul 3 (`ErstantwortRecoverySteps.tsx`), and for the
 * same reason: a placeholder that looks like art gets mistaken for the
 * decision. The caption says what the picture is supposed to show, so the
 * brief travels with the layout instead of in a separate document.
 *
 * <h3>Why it is capped and not full-bubble</h3>
 *
 * A square that fills the bubble is 1:1 of whatever the bubble is: ~290px on a
 * 390px phone and **528px** on the desktop, where `.pseudonymCard__bubble`
 * caps. A 528px square in a chat bubble is a poster, not an illustration, and
 * it would push the questions below the fold on every desktop. The cap is
 * therefore a real design constraint, not a rendering detail — which is why it
 * is a named prop with a documented default rather than a hard-coded number.
 *
 * **A raster image needs one more decision than an SVG.** The slot sizes
 * itself; a PNG/JPG dropped into it must ship at 2× the rendered edge (i.e.
 * 2 × `size` px square, 520px at the default) and carry `width`/`height`
 * attributes, or the bubble reflows once the file arrives and the questions
 * jump under the reader's thumb. An SVG has neither problem.
 *
 * STORYBOOK ONLY — nothing imports this outside the Erstantwort stories.
 */

export interface ErstantwortImageSlotProps {
	/**
	 * What the drawing is meant to show. Rendered as the caption, so the brief
	 * is visible to everyone looking at the layout.
	 */
	brief: string;
	/**
	 * Edge length of the reserved square, in px. The default is the width at
	 * which a square still reads as an illustration inside a chat bubble on
	 * both a 390px phone and a desktop.
	 */
	size?: number;
	testId?: string;
}

export const ERSTANTWORT_IMAGE_SLOT_SIZE = 260;

export const ErstantwortImageSlot: React.FC<ErstantwortImageSlotProps> = ({
	brief,
	size = ERSTANTWORT_IMAGE_SLOT_SIZE,
	testId = 'erstantwort-image-slot'
}) => (
	/*
	 * `aria-hidden`: the caption is a brief for the designer, not information
	 * for the reader. Announcing "Platz für Grafik — eine Hand legt einen Brief
	 * in einen Briefkasten" to somebody who has just written about something
	 * hard would be noise. When the real artwork arrives it brings its own alt
	 * text (or stays decorative), and that decision belongs to the artwork.
	 */
	<div
		className="erstantwortImageSlot"
		data-testid={testId}
		aria-hidden
		style={{ maxWidth: size }}
	>
		<span className="erstantwortImageSlot__kicker">Platz für Grafik</span>
		<span className="erstantwortImageSlot__brief">{brief}</span>
	</div>
);
