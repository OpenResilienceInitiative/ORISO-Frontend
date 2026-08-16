import whyLocalHelp from './why/vor-ort.webp';
import whyStateLaw from './why/gesetze.webp';
import whyAnonymous from './why/anonym.webp';
import whyInPerson from './why/persoenlich.webp';

import processWrite from './process/step1-schreiben.webp';
import processCounsellor from './process/step2-beraterin.webp';
import processReply from './process/step3-antwort.webp';

/**
 * Artwork for the reworked registration screens — the final motifs Frank
 * delivered, not placeholders.
 *
 * They arrived as PNGs at their generation size: 1024–1254 px square, 5.2 MB
 * for the seven of them. Resampled to twice the largest slot they are actually
 * drawn in and saved as WebP, they come to 52 kB — a hundredfold saving on a
 * screen whose whole point is that it must not cost load time.
 *
 * Slots:
 *   whyLocal.*  48 x 48 CSS px, round crop      → shipped at 96 x 96
 *   process.*   250 x 170 mobile / 264 x 264 desktop → shipped at 528 x 528
 *
 * If a motif is ever replaced, resize to those numbers rather than dropping in
 * the original: at the sizes they are drawn, nobody can see the difference.
 */
export interface RegistrationArtworkEntry {
	src: string;
	/** `true` while a slot still shows a stand-in. All finals now, so all false. */
	pending: boolean;
}

const delivered = (src: string): RegistrationArtworkEntry => ({
	src,
	pending: false
});

/**
 * Hero of the postcode step, from the ORISO icon master.
 *
 * Exported as a React component, not a URL: an SVG loaded through `<img>` is an
 * isolated document, so `fill="currentColor"` resolves to black there and the
 * icon cannot take the brand colour. Inlined, it inherits `color` normally.
 */
export { ReactComponent as AgencyCounsellingIcon } from './agency-counselling.svg';

/** The four reasons behind "Warum lokal beraten?", in display order. */
export const whyLocalArtwork = {
	localHelp: delivered(whyLocalHelp),
	stateLaw: delivered(whyStateLaw),
	anonymous: delivered(whyAnonymous),
	inPerson: delivered(whyInPerson)
} as const;

/** The three cards of the post-registration handover screen. */
export const processArtwork = {
	write: delivered(processWrite),
	counsellor: delivered(processCounsellor),
	reply: delivered(processReply)
} as const;

/**
 * A stand-in icon has to sit inside its frame; a delivered motif fills it.
 * Kept so a future placeholder cannot silently get cropped into nonsense.
 */
export const artworkFit = ({ pending }: RegistrationArtworkEntry) =>
	pending ? ('contain' as const) : ('cover' as const);

export const hasPendingArtwork = [
	...Object.values(whyLocalArtwork),
	...Object.values(processArtwork)
].some(({ pending }) => pending);
