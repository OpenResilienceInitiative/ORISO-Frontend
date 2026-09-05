import * as React from 'react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
// One Material arrow for both directions - the back button mirrors it in CSS.
// The design uses the arrow-with-tail, not the chevron in arrow-left.svg.
import { ReactComponent as ArrowIcon } from '../../resources/img/icons/arrow-right-m3.svg';
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
		<div className="askerInfo__footer">
			<button
				type="button"
				className="askerInfo__footer__button askerInfo__footer__button--back"
				onClick={onLeave}
				aria-label={translate('app.back')}
				title={translate('app.back')}
				data-cy="asker-info-footer-back"
			>
				<ArrowIcon />
			</button>
			<button
				type="button"
				className={`askerInfo__footer__button askerInfo__footer__button--next${
					hasPendingChange
						? ' askerInfo__footer__button--primary'
						: ''
				}`}
				onClick={onLeave}
				disabled={!hasPendingChange}
				aria-label={translate('app.next')}
				title={translate('app.next')}
				data-cy="asker-info-footer-next"
			>
				<ArrowIcon />
			</button>
		</div>
	);
};
