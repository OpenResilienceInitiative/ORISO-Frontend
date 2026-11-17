import * as React from 'react';
import { useContext, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import CloseIcon from '@mui/icons-material/Close';
import { LocaleContext } from '../globalState';
import { SidePanel } from '../components/chatStage/SidePanel';
import { AddonAppInSlot, appTitle } from './addonRegistry';
import { AddonMount } from './AddonMount';
import { useCaseAskerId } from './useCaseAskerId';
import { addonActionId } from './addonPanel';
import './addons.styles';

interface AddonSessionPanelProps extends AddonAppInSlot {
	agencyId?: number;
	sessionId?: number;
	variant?: React.ComponentProps<typeof SidePanel>['variant'];
	className?: string;
	onClose: () => void;
}

const focusLost = () =>
	!document.activeElement || document.activeElement === document.body;

/** An add-on app as the side panel of a counsellor's case view (`consultant.session`). */
export const AddonSessionPanel = ({
	addon,
	app,
	agencyId,
	sessionId,
	variant,
	className,
	onClose
}: AddonSessionPanelProps) => {
	const { t: translate } = useTranslation();
	const locale = useContext(LocaleContext)?.locale ?? 'de';
	const title = appTitle(app, locale);
	const { settled, askerId } = useCaseAskerId(sessionId);
	const heading = useRef<HTMLHeadingElement>(null);
	const actionId = addonActionId(addon.name, app.id);

	// On a phone the panel replaces the chat card: focus moves in with it and back to its button.
	useEffect(() => {
		heading.current?.focus();
		return () => {
			if (focusLost()) {
				Array.from(
					document.querySelectorAll<HTMLElement>(
						'[data-addon-action]'
					)
				)
					.find((action) => action.dataset.addonAction === actionId)
					?.focus();
			}
		};
	}, [actionId]);

	return (
		<SidePanel
			variant={variant}
			className={className}
			label={translate('addons.panel.region', { title })}
			data-cy="stage-panel"
			header={
				<div className="addonPanel__header">
					<h2
						className="addonPanel__title"
						ref={heading}
						tabIndex={-1}
					>
						{title}
					</h2>
					<button
						type="button"
						className="addonPanel__close"
						onClick={onClose}
						aria-label={translate('addons.panel.close')}
					>
						<CloseIcon aria-hidden="true" />
					</button>
				</div>
			}
			content={
				settled ? (
					<AddonMount
						addon={addon}
						app={app}
						slot="consultant.session"
						placement={{ agencyId, sessionId, askerId }}
					/>
				) : (
					<div className="addonMount" aria-busy="true" />
				)
			}
		/>
	);
};
