import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CallOffIcon } from '../../resources/img/icons/call-off.svg';
import { ReactComponent as InfoIcon } from '../../resources/img/icons/i.svg';

export const ICON_CALL_OFF = 'call_off';
export const ICON_INFO = 'info';

interface SystemMessageProps {
	subject?: React.ReactElement;
	icon?: typeof ICON_CALL_OFF | typeof ICON_INFO;
	children?: React.ReactElement;
	variant?: 'default' | 'team-access';
	teamAccessAllowed?: boolean;
	onTeamAccessChange?: (allowed: boolean) => void;
	pending?: boolean;
	error?: string;
}

export const SystemMessage: React.FC<SystemMessageProps> = ({
	subject,
	icon,
	children,
	variant = 'default',
	teamAccessAllowed = true,
	onTeamAccessChange,
	pending = false,
	error
}) => {
	const { t: translate } = useTranslation();
	const getIcon = useCallback(() => {
		switch (icon) {
			case ICON_CALL_OFF:
				return CallOffIcon;
			case ICON_INFO:
				return InfoIcon;
		}
		return null;
	}, [icon]);

	const Icon = getIcon();

	const isTeamAccess = variant === 'team-access';
	const resolvedSubject =
		subject ??
		(isTeamAccess ? (
			<>{translate('teamAccess.systemMessage.title')}</>
		) : null);

	return (
		<div
			className={`systemMessage__subjectWrapper${isTeamAccess ? ' systemMessage__subjectWrapper--teamAccess' : ''}`}
			aria-busy={pending || undefined}
		>
			{Icon && (
				<div>
					<Icon
						className="systemMessage__icon"
						title={
							icon === 'call_off'
								? translate('videoCall.info')
								: translate('notifications.info')
						}
						aria-label={
							icon === 'call_off'
								? translate('videoCall.info')
								: translate('notifications.info')
						}
					/>
				</div>
			)}
			<div>
				{resolvedSubject && (
					<p className="systemMessage__subject">{resolvedSubject}</p>
				)}
				{isTeamAccess ? (
					<>
						<p className="systemMessage__infoText">
							{translate('teamAccess.systemMessage.description')}
						</p>
						<div className="systemMessage__teamAccessControl">
							<span>
								{translate(
									'teamAccess.systemMessage.controlLabel'
								)}
							</span>
							<button
								type="button"
								role="switch"
								aria-checked={teamAccessAllowed}
								aria-label={translate(
									'teamAccess.systemMessage.controlLabel'
								)}
								className={`systemMessage__teamAccessSwitch${teamAccessAllowed ? ' systemMessage__teamAccessSwitch--checked' : ''}`}
								disabled={pending || !onTeamAccessChange}
								onClick={() =>
									onTeamAccessChange?.(!teamAccessAllowed)
								}
							>
								<span aria-hidden />
							</button>
						</div>
						{!teamAccessAllowed && (
							<p className="systemMessage__teamAccessStatus">
								{translate(
									'teamAccess.systemMessage.consentRequired'
								)}
							</p>
						)}
						{error && (
							<p
								className="systemMessage__teamAccessError"
								role="alert"
							>
								{error}
							</p>
						)}
					</>
				) : (
					children
				)}
			</div>
		</div>
	);
};
