import * as React from 'react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { SideScrollerFooter } from '../sideScrollerFooter/SideScrollerFooter';
import { AskerInfoActionContext } from './askerInfoActionContext';

export interface AskerInfoFooterProps {
	/** Where both buttons lead — the session this profile belongs to. */
	onLeave: () => void;
}

/**
 * Client-profile footer (ORISO-Frontend#1192, job 2).
 *
 * Matches the "Side Scroller Footer" in the Figma Components page: two 128×96
 * pills, back on the left and next on the right.
 *
 * Back is always active — leaving the profile is never gated on what the user
 * did or did not change. Next stays inert until the allocation actually
 * differs from the session's current consultant, and only then turns primary;
 * there is nothing to continue with while nothing is pending, and a permanently
 * red button would promise otherwise.
 */
export const AskerInfoFooter = ({ onLeave }: AskerInfoFooterProps) => {
	const { t: translate } = useTranslation();
	const { hasPendingChange } = useContext(AskerInfoActionContext);

	return (
		<SideScrollerFooter
			className="askerInfo__footer"
			back={{
				label: translate('app.back'),
				onClick: onLeave,
				className:
					'askerInfo__footer__button askerInfo__footer__button--back',
				dataCy: 'asker-info-footer-back'
			}}
			next={{
				label: translate('app.next'),
				onClick: hasPendingChange ? onLeave : undefined,
				ariaDisabled: !hasPendingChange,
				className: `askerInfo__footer__button askerInfo__footer__button--next${hasPendingChange ? ' askerInfo__footer__button--primary' : ''}`,
				dataCy: 'asker-info-footer-next'
			}}
		/>
	);
};
