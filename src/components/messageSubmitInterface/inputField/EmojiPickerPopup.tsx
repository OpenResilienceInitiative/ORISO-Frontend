import * as React from 'react';
import { Suspense, useEffect, useRef } from 'react';
import type { MenuDirection } from './menuDirection';
import './emojiPickerPopup.styles.scss';

// emoji-picker-react is ~200KB of emoji data — load it only when opened.
const EmojiPicker = React.lazy(() => import('emoji-picker-react'));

export interface EmojiPickerPopupProps {
	direction: MenuDirection;
	onPick: (emoji: string) => void;
	onClose: () => void;
}

/**
 * Full emoji picker popup (categories, search, skin tones), themed to the
 * M3 palette. Replaces the previous hardcoded 8-emoji strip.
 */
export const EmojiPickerPopup = ({
	direction,
	onPick,
	onClose
}: EmojiPickerPopupProps) => {
	const popupRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (
				popupRef.current &&
				target &&
				!popupRef.current.contains(target)
			) {
				onClose();
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
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

	return (
		<div
			ref={popupRef}
			className={`emojiPickerPopup emojiPickerPopup--${direction}`}
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
				/>
			</Suspense>
		</div>
	);
};
