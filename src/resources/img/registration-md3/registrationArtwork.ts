import placeholderLocalHelp from '../icons/location.svg';
import placeholderLaw from '../icons/documents.svg';
import placeholderAnonymous from '../icons/lock.svg';
import placeholderInPerson from '../icons/persons-two.svg';

import placeholderWrite from '../icons/pen-paper.svg';
import placeholderCounsellor from '../icons/persons.svg';
import placeholderReply from '../icons/envelope.svg';

/**
 * Artwork for the reworked registration screens.
 *
 * ⚠️ PLACEHOLDERS — Frank is delivering the final, uncompressed motifs in one
 * batch (2026-08-06). Swapping them is a single-file change: drop the files in
 * `registration-md3/` and repoint the imports above. Nothing else references
 * these paths.
 *
 * The stand-ins are deliberately plain ORISO icons, not illustrations: an
 * illustration cropped into the wrong frame reads as a finished-but-broken
 * design, and someone reviewing the screens should be able to tell at a glance
 * what is still missing.
 *
 * Target sizes when the finals arrive:
 *   whyLocal.*  48 x 48 CSS px, round crop → ship 96 x 96 (2x)
 *   process.*   250 x 170 mobile card, 264 x 264 desktop square → ship 528 x 528 (2x)
 */
export interface RegistrationArtworkEntry {
	src: string;
	/** `true` while this slot still shows a stand-in. Drives the "fit" below. */
	pending: boolean;
}

const placeholder = (src: string): RegistrationArtworkEntry => ({
	src,
	pending: true
});

/**
 * Hero of the postcode step, delivered by Frank from the ORISO icon master.
 *
 * Exported as a React component, not a URL: an SVG loaded through `<img>` is an
 * isolated document, so `fill="currentColor"` resolves to black there and the
 * icon cannot take the brand colour. Inlined, it inherits `color` normally.
 */
export { ReactComponent as AgencyCounsellingIcon } from './agency-counselling.svg';

/** The four reasons behind "Warum lokal beraten?", in display order. */
export const whyLocalArtwork = {
	localHelp: placeholder(placeholderLocalHelp),
	stateLaw: placeholder(placeholderLaw),
	anonymous: placeholder(placeholderAnonymous),
	inPerson: placeholder(placeholderInPerson)
} as const;

/** The three cards of the post-registration handover screen. */
export const processArtwork = {
	write: placeholder(placeholderWrite),
	counsellor: placeholder(placeholderCounsellor),
	reply: placeholder(placeholderReply)
} as const;

/**
 * A stand-in icon must sit inside its frame; a delivered photo must fill it.
 * Using `cover` on an icon crops it into nonsense.
 */
export const artworkFit = ({ pending }: RegistrationArtworkEntry) =>
	pending ? ('contain' as const) : ('cover' as const);

export const hasPendingArtwork = [
	...Object.values(whyLocalArtwork),
	...Object.values(processArtwork)
].some(({ pending }) => pending);
