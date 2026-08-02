import * as React from 'react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { autoUpdate, computePosition, offset, shift } from '@floating-ui/dom';
import type { Theme } from 'emoji-picker-react';
import type { MenuDirection } from './menuDirection';
import './emojiPickerPopup.styles.scss';

// emoji-picker-react is ~200KB of emoji data — load it only when opened.
const EmojiPicker = React.lazy(() => import('emoji-picker-react'));

/** Keep light chrome even when the OS prefers dark (avoids #835 dark clip). */
const LIGHT_THEME = 'light' as Theme;

export interface EmojiPickerPopupProps {
	direction: MenuDirection;
	onPick: (emoji: string) => void;
	onClose: () => void;
	/**
	 * Toolbar emoji toggle used as the floating-ui anchor. Required so the
	 * picker can portal to <body> and avoid `.session { overflow: hidden }`
	 * clipping (#835).
	 */
	anchorEl: HTMLElement | null;
}

/**
 * Full emoji picker popup (categories, search, skin tones), themed to the
 * M3 palette. Portalled to document.body (same pattern as ToolbarMenu) so
 * docked composers never clip a dark fragment over emoji / mention controls.
 */
export const EmojiPickerPopup = ({
	direction,
	onPick,
	onClose,
	anchorEl
}: EmojiPickerPopupProps) => {
	const popupRef = useRef<HTMLDivElement | null>(null);
	const [position, setPosition] = useState<{ top: number; left: number }>({
		top: -9999,
		left: -9999
	});

	useEffect(() => {
		const popupEl = popupRef.current;
		if (!anchorEl || !popupEl) {
			return;
		}
		return autoUpdate(anchorEl, popupEl, () => {
			computePosition(anchorEl, popupEl, {
				// Match ToolbarMenu: docked/mobile open upward, fullscreen down.
				placement: direction === 'up' ? 'top-start' : 'bottom-start',
				middleware: [offset(8), shift({ padding: 8 })]
			}).then(({ x, y }) => setPosition({ left: x, top: y }));
		});
	}, [anchorEl, direction]);

	useEffect(() => {
		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (!(target instanceof Element)) {
				return;
			}
			// Toggle button owns open/close — don't close here or the following
			// click will reopen the picker.
			if (target.closest('[data-emoji-picker-toggle]')) {
				return;
			}
			if (popupRef.current && !popupRef.current.contains(target)) {
				onClose();
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose();
			}
		};
		document.addEventListener('pointerdown', handlePointerDown);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [onClose]);

	if (typeof document === 'undefined') {
		return null;
	}

	return createPortal(
		<div
			ref={popupRef}
			className={`emojiPickerPopup emojiPickerPopup--${direction} emojiPickerPopup--portalled`}
			style={{ top: position.top, left: position.left }}
			data-testid="emoji-picker-popup"
		>
			<Suspense
				fallback={<div className="emojiPickerPopup__loading">…</div>}
			>
				<EmojiPicker
					onEmojiClick={(emojiData) => {
						onPick(emojiData.emoji);
					}}
					width={320}
					height={380}
					lazyLoadEmojis
					skinTonesDisabled={false}
					searchPlaceHolder="Suchen"
					previewConfig={{ showPreview: false }}
					theme={LIGHT_THEME}
				/>
			</Suspense>
		</div>,
		document.body
	);
};
