import * as React from 'react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as BackIcon } from '../../resources/img/icons/arrow-left.svg';
import { ReactComponent as NextIcon } from '../../resources/img/icons/arrow-right.svg';
import { AskerInfoActionContext } from './askerInfoActionContext';

export interface AskerInfoFooterProps {
	/** Where the back button returns to — the session this profile belongs to. */
	onBack: () => void;
}

/**
 * Client-profile footer (ORISO-Frontend#1192, job 2).
 *
 * Back is always active: leaving the profile is never blocked, whatever the
 * user has or has not filled in. Next is only primary once the allocation
 * actually changed, and is disabled until then — there is no action to
 * continue with while nothing is pending, and an always-red button would
 * promise one.
 */
export const AskerInfoFooter = ({ onBack }: AskerInfoFooterProps) => {
	const { t: translate } = useTranslation();
	const { hasPendingChange, requestConfirm } = useContext(
		AskerInfoActionContext
	);

	return (
		<div className="askerInfo__footer">
			<button
				type="button"
				className="askerInfo__footer__button askerInfo__footer__button--back"
				onClick={onBack}
				aria-label={translate('app.back')}
				title={translate('app.back')}
				data-cy="asker-info-footer-back"
			>
				<BackIcon />
			</button>
			<button
				type="button"
				className={`askerInfo__footer__button askerInfo__footer__button--next${
					hasPendingChange
						? ' askerInfo__footer__button--primary'
						: ''
				}`}
				onClick={requestConfirm}
				disabled={!hasPendingChange}
				aria-label={translate('app.next')}
				title={translate('app.next')}
				data-cy="asker-info-footer-next"
			>
				<NextIcon />
			</button>
		</div>
	);
};
