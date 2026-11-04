import * as React from 'react';
import { useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SessionTypeContext } from '../../globalState';
import { useSearchParam } from '../../hooks/useSearchParams';
import { ReactComponent as XIcon } from '../../resources/img/illustrations/x.svg';
import { BUTTON_TYPES } from '../button/Button';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../overlay/Overlay';
import { SESSION_LIST_TAB } from './sessionHelpers';

/** #1472: explains why an enquiry is no longer on offer and leads back to the list. */
export const EnquiryTakenNotice = () => {
	const { t: translate } = useTranslation();
	const navigate = useNavigate();
	const { path: listPath } = useContext(SessionTypeContext);
	const sessionListTab = useSearchParam<SESSION_LIST_TAB>('sessionListTab');

	const item: OverlayItem = useMemo(
		() => ({
			svg: XIcon,
			headline: translate(
				'session.anonymous.takenByOtherConsultant.overlay.headline'
			),
			illustrationBackground: 'error',
			buttonSet: [
				{
					label: translate(
						'session.anonymous.takenByOtherConsultant.button.label'
					),
					function: OVERLAY_FUNCTIONS.CLOSE,
					type: BUTTON_TYPES.PRIMARY
				}
			]
		}),
		[translate]
	);

	return (
		<Overlay
			item={item}
			handleOverlay={() =>
				navigate(
					`${listPath}${sessionListTab ? `?sessionListTab=${sessionListTab}` : ''}`
				)
			}
		/>
	);
};
