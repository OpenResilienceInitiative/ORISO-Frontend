import { createContext, Dispatch, SetStateAction } from 'react';
import type { OVERLAY_TYPES } from '../interfaces/AppConfig/OverlaysConfigInterface';

export type TOverlay = {
	id: string;
	name: OVERLAY_TYPES;
};

export const ModalContext = createContext<{
	overlays: TOverlay[];
	setOverlays: Dispatch<SetStateAction<TOverlay[]>>;
	addOverlay: (overlay: TOverlay) => void;
	removeOverlay: (unique: string) => void;
}>(null);
