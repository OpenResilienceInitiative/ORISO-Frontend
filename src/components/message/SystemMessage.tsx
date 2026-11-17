import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CallOffIcon } from '../../resources/img/icons/call-off.svg';
import { ReactComponent as InfoIcon } from '../../resources/img/icons/i.svg';

export const ICON_CALL_OFF = 'call_off';
export const ICON_INFO = 'info';

interface SystemMessageProps {
	subject: React.ReactElement;
	icon?: typeof ICON_CALL_OFF | typeof ICON_INFO;
	children?: React.ReactElement;
}

/**
 * The system-notice icon as Storybook shows it (Chat/System messages/General
 * notices): same glyph, size and `--m3-secondary` colour wherever a platform
 * notice needs it, e.g. the call card's avatar column (#2237).
 */
export const SystemMessageIcon = ({
	icon
}: {
	icon: typeof ICON_CALL_OFF | typeof ICON_INFO;
}) => {
	const { t: translate } = useTranslation();
	const Icon = icon === ICON_CALL_OFF ? CallOffIcon : InfoIcon;
	const label =
		icon === ICON_CALL_OFF
			? translate('videoCall.info')
			: translate('notifications.info');
	return (
		<Icon
			className="systemMessage__icon"
			title={label}
			aria-label={label}
		/>
	);
};

export const SystemMessage: React.FC<SystemMessageProps> = ({
	subject,
	icon,
	children
}) => {
	return (
		<div className="systemMessage__subjectWrapper">
			{icon && (
				<div>
					<SystemMessageIcon icon={icon} />
				</div>
			)}
			<div>
				<p className="systemMessage__subject">{subject}</p>
				{children}
			</div>
		</div>
	);
};
