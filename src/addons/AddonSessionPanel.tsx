import * as React from 'react';
import { useContext, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import CloseIcon from '@mui/icons-material/Close';
import { LocaleContext } from '../globalState';
import { SidePanel } from '../components/chatStage/SidePanel';
import { AddonAppInSlot, appTitle } from './addonRegistry';
import { AddonMount } from './AddonMount';
import { useCaseAskerId } from './useCaseAskerId';
import { addonActionId, AddonPanelSlot } from './addonPanel';
import { AddonIcon } from './AddonIcon';
import './addons.styles';

interface AddonSessionPanelProps extends AddonAppInSlot {
	slot?: AddonPanelSlot;
	agencyId?: number;
	sessionId?: number;
	variant?: React.ComponentProps<typeof SidePanel>['variant'];
	className?: string;
	onClose: () => void;
}

const focusLost = () =>
	!document.activeElement || document.activeElement === document.body;

const isShown = (element: HTMLElement) =>
	element.getClientRects().length > 0 &&
	getComputedStyle(element).visibility !== 'hidden';

// A menu entry is gone with its closed menu; then the menu's own button takes focus.
const returnFocus = (actionId: string) => {
	const actions = Array.from(
		document.querySelectorAll<HTMLElement>('[data-addon-action]')
	).filter((action) => action.dataset.addonAction === actionId);
	const target =
		actions.find(isShown) ??
		(actions.some((action) => action.dataset.addonMenuEntry !== undefined)
			? Array.from(
					document.querySelectorAll<HTMLElement>(
						'[aria-controls="flyout"]'
					)
				).find(isShown)
			: actions[0]);
	target?.focus();
};

/**
 * An add-on app as the side panel beside a chat: the counsellor's case view
 * (`consultant.session`, `consultant.session-menu`) or the client's chat (`asker.session-menu`).
 */
export const AddonSessionPanel = ({
	addon,
	app,
	slot = 'consultant.session',
	agencyId,
	sessionId,
	variant,
	className,
	onClose
}: AddonSessionPanelProps) => {
	const { t: translate } = useTranslation();
	const locale = useContext(LocaleContext)?.locale ?? 'de';
	const title = appTitle(app, locale);
	// Clients are the asker themselves; only a counsellor's case has another one to look up.
	const forCounsellor = slot !== 'asker.session-menu';
	const { settled, askerId } = useCaseAskerId(sessionId, forCounsellor);
	const ready = !forCounsellor || settled;
	const heading = useRef<HTMLHeadingElement>(null);
	const actionId = addonActionId(addon.name, app.id);

	// On a phone the panel replaces the chat card: focus moves in with it and back to its button.
	useEffect(() => {
		heading.current?.focus();
		return () => {
			if (focusLost()) {
				returnFocus(actionId);
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
						<AddonIcon
							icon={app.icon}
							className="addonPanel__icon"
						/>
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
				ready ? (
					<AddonMount
						addon={addon}
						app={app}
						slot={slot}
						placement={{ agencyId, sessionId, askerId }}
					/>
				) : (
					<div className="addonMount" aria-busy="true" />
				)
			}
		/>
	);
};
