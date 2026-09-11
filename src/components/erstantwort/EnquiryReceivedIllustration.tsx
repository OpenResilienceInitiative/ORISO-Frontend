import * as React from 'react';
import { ReactComponent as EnquiryReceived } from '../../resources/img/illustrations/enquiry-received.svg';
import './EnquiryReceivedIllustration.styles.scss';

/**
 * The picture above the first post-dispatch bubble (ORISO-Frontend#825).
 *
 * It carries no information the copy does not also carry — someone using a
 * screen reader, a text browser or a slow connection loses nothing — so it is
 * marked decorative rather than described. Illustrating a moment of relief is
 * the whole job: the person has just written something hard and pressed send.
 *
 * The shipped file is a flat placeholder in the platform's rose. The final
 * three-panel illustration replaces `enquiry-received.svg` and nothing here
 * changes with it.
 */
export const EnquiryReceivedIllustration: React.FC = () => (
	<div className="enquiryReceivedIllustration" aria-hidden="true">
		<EnquiryReceived />
	</div>
);
