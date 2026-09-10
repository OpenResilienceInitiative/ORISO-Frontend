/**
 * Call controls for a side room's header (Frank, 09.09.2026: "auch braucht
 * die supervision die möglichkeit das man einen call haben kann entweder
 * video oder audio").
 *
 * Deliberately no second set of anything: the glyphs are the main chat's
 * (`call/CallHeaderIcons`), the button is the app's `Button` molecule in the
 * same `SMALL_ICON` / transparent shape the session header uses, the kebab
 * card is the chat menu organism (`ChatMenuDropdown` + `ChatMenuDropdownItem`,
 * the rows `SessionMenu` renders under `callsInMenu`), and the kebab trigger
 * wears the panel header's own `panelHeader__iconButton` next to the close
 * button. What to show, where and whether it is enabled comes from
 * `panelCallActionsState.ts`.
 *
 * The component never starts a call itself — the host hands in `onStartCall`,
 * which goes to the ONE trigger (`call/startRoomCall.ts`) with the side
 * room's own Matrix room id.
 *
 * Copy is injected rather than translated here (i18n guard, drift budget 0):
 * the app passes `translate(…)` values, stories pass literals.
 */
import * as React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button, BUTTON_TYPES, type ButtonItem } from '../button/Button';
import {
	AudioCallHeaderIcon,
	VideoCallHeaderIcon
} from '../call/CallHeaderIcons';
import {
	ChatMenuDropdown,
	ChatMenuDropdownItem
} from '../chatMenuDropdown/ChatMenuDropdown';
import { ReactComponent as MenuVerticalIcon } from '../../resources/img/icons/stack-vertical.svg';
import {
	resolvePanelCallActions,
	type PanelCallKind
} from './panelCallActionsState';
import './panelCallActions.styles.scss';

export interface PanelCallActionsCopy {
	/** "Video-Call starten" — `videoCall.button.startVideoCall`. */
	video: string;
	/** "Audio-Call starten" — `videoCall.button.startCall`. */
	audio: string;
	/** Kebab label — `app.menu`. */
	menu: string;
	/**
	 * How many people are in the side room, already translated
	 * (`chatStage.panel.participantCount`). It is what the disabled state
	 * says instead of a sentence of its own: at "1 Person" the reason the
	 * buttons are grey is on the tooltip, in every locale, without a new
	 * catalogue key (the i18n guard runs on a drift budget of 0).
	 */
	participants: string;
}

export interface PanelCallActionsProps {
	/** `true` for video, `false` for audio — the main chat's own signature. */
	'onStartCall': (isVideo: boolean) => void;
	'copy': PanelCallActionsCopy;
	'audioEnabled'?: boolean;
	'videoEnabled'?: boolean;
	/** People visible in the side room, me included. */
	'participantCount': number;
	/** Measured panel width; `null` before the first measurement. */
	'width'?: number | null;
	/** Viewport phone (`useResponsive().untilM`). */
	'phone'?: boolean;
	'data-cy'?: string;
}

const glyphFor = (kind: PanelCallKind) =>
	kind === 'video' ? <VideoCallHeaderIcon /> : <AudioCallHeaderIcon />;

export const PanelCallActions = ({
	onStartCall,
	copy,
	audioEnabled = true,
	videoEnabled = true,
	participantCount,
	width = null,
	phone = false,
	'data-cy': dataCy = 'panel-call-actions'
}: PanelCallActionsProps) => {
	const state = resolvePanelCallActions({
		width,
		participantCount,
		audioEnabled,
		videoEnabled,
		phone
	});
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const menuId = useId();

	const close = useCallback(() => setOpen(false), []);
	const closeAndRefocus = useCallback(() => {
		setOpen(false);
		triggerRef.current?.focus();
	}, []);

	// Same dismissal contract as the panel header's channel card.
	useEffect(() => {
		if (!open) {
			return undefined;
		}
		const onPointerDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) {
				close();
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				closeAndRefocus();
			}
		};
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open, close, closeAndRefocus]);

	// The placement can change under an open menu (the reader drags the
	// divider); the row has nothing to close into.
	useEffect(() => {
		if (state.placement === 'row') {
			setOpen(false);
		}
	}, [state.placement]);

	if (!state.visible) {
		return null;
	}

	const labelFor = (kind: PanelCallKind) =>
		kind === 'video' ? copy.video : copy.audio;
	const titleFor = (kind: PanelCallKind) =>
		state.disabled
			? `${labelFor(kind)} – ${copy.participants}`
			: labelFor(kind);

	if (state.placement === 'row') {
		return (
			<div
				className="panelCallActions panelCallActions--row"
				data-cy={dataCy}
				data-placement="row"
				data-disabled={state.disabled ? 'true' : 'false'}
			>
				{state.kinds.map((kind) => {
					const item: ButtonItem = {
						type: BUTTON_TYPES.SMALL_ICON,
						smallIconBackgroundColor: 'transparent',
						title: titleFor(kind),
						icon: glyphFor(kind)
					};
					return (
						<Button
							key={kind}
							item={item}
							disabled={state.disabled}
							buttonHandle={() => onStartCall(kind === 'video')}
							className={`panelCallActions__button panelCallActions__button--${kind}`}
							testingAttribute={`panel-call-${kind}`}
						/>
					);
				})}
			</div>
		);
	}

	return (
		<div
			ref={rootRef}
			className="panelCallActions panelCallActions--menu"
			data-cy={dataCy}
			data-placement="menu"
			data-disabled={state.disabled ? 'true' : 'false'}
		>
			<button
				ref={triggerRef}
				type="button"
				className="panelHeader__iconButton panelCallActions__trigger"
				aria-label={copy.menu}
				title={copy.menu}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={open ? menuId : undefined}
				data-cy="panel-call-menu-trigger"
				onClick={() => setOpen((value) => !value)}
			>
				<MenuVerticalIcon aria-hidden="true" />
			</button>
			{open && (
				<ChatMenuDropdown
					id={menuId}
					ariaLabel={copy.menu}
					className="panelCallActions__menu"
					data-cy="panel-call-menu"
				>
					{state.kinds.map((kind) => (
						<ChatMenuDropdownItem
							key={kind}
							icon={glyphFor(kind)}
							title={labelFor(kind)}
							description={
								state.disabled ? copy.participants : undefined
							}
							disabled={state.disabled}
							data-cy={`panel-call-menu-${kind}`}
							onClick={() => {
								closeAndRefocus();
								onStartCall(kind === 'video');
							}}
						/>
					))}
				</ChatMenuDropdown>
			)}
		</div>
	);
};

export default PanelCallActions;
