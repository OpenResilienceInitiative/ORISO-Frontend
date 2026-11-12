import * as React from 'react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import CloseIcon from '@mui/icons-material/Close';
import { LocaleContext } from '../globalState';
import { SidePanel } from '../components/chatStage/SidePanel';
import { AddonAppInSlot, appTitle } from './addonRegistry';
import { AddonMount } from './AddonMount';
import './addons.styles';

interface AddonSessionPanelProps extends AddonAppInSlot {
	agencyId?: number;
	sessionId?: number;
	variant?: React.ComponentProps<typeof SidePanel>['variant'];
	className?: string;
	onClose: () => void;
}

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

	return (
		<SidePanel
			variant={variant}
			className={className}
			label={translate('addons.panel.region', { title })}
			data-cy="stage-panel"
			header={
				<div className="addonPanel__header">
					<h2 className="addonPanel__title">{title}</h2>
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
				<AddonMount
					addon={addon}
					app={app}
					slot="consultant.session"
					placement={{ agencyId, sessionId }}
				/>
			}
		/>
	);
};
