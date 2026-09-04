/**
 * Header molecule for a side panel — the Figma "Room Header All"
 * (1320:38278 → Chat Room Desktop) at reduced height: one 40 px row
 * (title/small in `secondary`, actions right), the `primary-fixed`
 * hairline and the tag slot under it (label/medium on `primary-fixed`),
 * exactly the tokens the room header binds. No avatar stack, no calls.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as BackIcon } from '../../resources/img/icons/arrow-left.svg';
import { ReactComponent as CloseIcon } from '../../resources/img/icons/close.svg';
import './sidePanel.styles.scss';

export interface PanelHeaderProps {
	/** "Supervision" / "Thread". */
	'title': string;
	/** Counterpart shown after the separator: "· Bettina B.". */
	'name'?: string;
	/** Role chip text ("Supervision" / "Beratung"). */
	'chip'?: string;
	'unreadCount'?: number;
	/** Tag under the hairline — topic or the privacy hint. */
	'tag'?: string;
	/** Phone: back to the main chat. Rendered before the title. */
	'onBack'?: () => void;
	/** Desktop: close the panel. Rendered at the end of the row. */
	'onClose'?: () => void;
	/** Extra actions before the close button. */
	'actions'?: React.ReactNode;
	'data-cy'?: string;
}

export const PanelHeader = ({
	title,
	name,
	chip,
	unreadCount = 0,
	tag,
	onBack,
	onClose,
	actions,
	'data-cy': dataCy = 'panel-header'
}: PanelHeaderProps) => {
	const { t: translate } = useTranslation();
	const unreadLabel =
		unreadCount > 0
			? translate('supervision.panel.unread', { count: unreadCount })
			: '';

	return (
		<header className="panelHeader" data-cy={dataCy}>
			<div className="panelHeader__row">
				{onBack && (
					<button
						type="button"
						className="panelHeader__backButton"
						onClick={onBack}
						aria-label={translate('chatStage.panel.back')}
						title={translate('chatStage.panel.back')}
						data-cy="panel-header-back"
					>
						<BackIcon aria-hidden="true" />
					</button>
				)}
				<h2 className="panelHeader__title" data-cy="panel-header-title">
					<span className="panelHeader__titleLabel">{title}</span>
					{name && (
						<>
							<span
								className="panelHeader__titleSeparator"
								aria-hidden="true"
							>
								·
							</span>
							<span
								className="panelHeader__titleName"
								data-cy="panel-header-name"
							>
								{name}
							</span>
						</>
					)}
				</h2>
				{chip && (
					<span
						className="panelHeader__chip"
						data-cy="panel-header-chip"
					>
						{chip}
					</span>
				)}
				{unreadCount > 0 && (
					<span
						className="panelHeader__unread"
						data-cy="panel-header-unread"
						aria-label={unreadLabel}
						title={unreadLabel}
					>
						{unreadCount > 99 ? '99+' : unreadCount}
					</span>
				)}
				<div className="panelHeader__actions">
					{actions}
					{onClose && (
						<button
							type="button"
							className="panelHeader__iconButton"
							onClick={onClose}
							aria-label={translate('chatStage.panel.close')}
							title={translate('chatStage.panel.close')}
							data-cy="panel-header-close"
						>
							<CloseIcon aria-hidden="true" />
						</button>
					)}
				</div>
			</div>
			<div className="panelHeader__divider">
				{tag && (
					<span
						className="panelHeader__tag"
						data-cy="panel-header-tag"
					>
						{tag}
					</span>
				)}
			</div>
		</header>
	);
};

export default PanelHeader;
