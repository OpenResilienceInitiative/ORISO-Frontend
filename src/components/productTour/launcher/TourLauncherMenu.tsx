import * as React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { ReactComponent as CloseGlyph } from '../../../resources/img/icons/fab-menu-close.svg';
import {
	ChatMenuDropdown,
	ChatMenuDropdownDivider,
	ChatMenuDropdownHeader,
	ChatMenuDropdownItem,
	handleMenuKeyDown
} from '../../chatMenuDropdown/ChatMenuDropdown';
import type { ITutorialProgressItem } from '../../../api/apiTutorialProgress';
import { actionForStatus, type TourStartMode } from '../TourOverviewCarousel';
import type { TourDefinition, TourStatus } from '../types';
import './tourLauncher.styles.scss';

export type TourLauncherProgress = Pick<
	ITutorialProgressItem,
	'tourId' | 'tourVersion' | 'status'
>;

export interface TourLauncherMenuProps {
	/** Tours to offer, already filtered and ordered for this user and page. */
	tours: TourDefinition[];
	progress: TourLauncherProgress[];
	onStartTour: (tour: TourDefinition, mode: TourStartMode) => void;
	/** "Rundgänge verwalten": Help → Rundgänge, where the switch lives. */
	onManage: () => void;
	/** Called when the card opens, e.g. to refresh the progress. */
	onOpen?: () => void;
	/** Start with the card open (stories / comparisons). */
	defaultOpen?: boolean;
}

const statusOf = (
	tour: TourDefinition,
	progress: TourLauncherProgress[]
): TourStatus =>
	progress.find(
		(item) => item.tourId === tour.id && item.tourVersion === tour.version
	)?.status ?? 'not_started';

/**
 * The "?" tour launcher: the design system's FAB (Figma "FAB menu"
 * 9748:60084) opening the chat menu organism with one row per tour
 * (title + status). Picking a row starts, continues or restarts that tour.
 */
export const TourLauncherMenu = ({
	tours,
	progress,
	onStartTour,
	onManage,
	onOpen,
	defaultOpen = false
}: TourLauncherMenuProps) => {
	const { t: translate } = useTranslation();
	const [open, setOpen] = useState(defaultOpen);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const fabRef = useRef<HTMLButtonElement | null>(null);
	const listRef = useRef<HTMLUListElement | null>(null);
	const menuId = useId();

	const close = useCallback(() => setOpen(false), []);
	const closeAndRefocus = useCallback(() => {
		setOpen(false);
		fabRef.current?.focus();
	}, []);

	useEffect(() => {
		if (!open) return undefined;
		// Keyboard users land on the first tour.
		listRef.current
			?.querySelector<HTMLElement>('[role="menuitem"]')
			?.focus();
		const onPointerDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) close();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeAndRefocus();
		};
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open, close, closeAndRefocus]);

	const toggle = () => {
		if (!open) onOpen?.();
		setOpen((value) => !value);
	};

	const title = translate('tour.launcher.title');
	const fabLabel = translate(
		open ? 'tour.launcher.close' : 'tour.launcher.open'
	);

	return (
		<div
			ref={rootRef}
			className={`tourLauncher${open ? ' tourLauncher--open' : ''}`}
			data-cy="tour-launcher"
		>
			{open && (
				<div className="tourLauncher__menu">
					<ChatMenuDropdown
						className="tourLauncher__card"
						role="presentation"
						data-cy="tour-launcher-menu"
					>
						<ChatMenuDropdownHeader
							subtitle={translate('tour.launcher.eyebrow')}
							title={title}
						/>
						<ChatMenuDropdownDivider />
						<ul
							ref={listRef}
							id={menuId}
							role="menu"
							aria-label={title}
							className="chatMenuDropdown__section tourLauncher__list"
							onKeyDown={handleMenuKeyDown}
						>
							{tours.map((tour) => {
								const status = statusOf(tour, progress);
								const mode = actionForStatus(status);
								const tourTitle = translate(tour.titleKey);
								const statusLabel = translate(
									`walkthrough.overview.status.${status}`
								);
								return (
									<li key={tour.id} role="none">
										<ChatMenuDropdownItem
											role="menuitem"
											className="tourLauncher__item"
											data-cy={`tour-launcher-item-${tour.id}`}
											data-status={status}
											aria-label={`${translate(
												`walkthrough.overview.action.${mode}`
											)}: ${tourTitle} – ${statusLabel}`}
											icon={
												<ExploreOutlinedIcon aria-hidden="true" />
											}
											title={tourTitle}
											description={statusLabel}
											onClick={() => {
												close();
												onStartTour(tour, mode);
											}}
										/>
									</li>
								);
							})}
							<ChatMenuDropdownDivider as="li" role="separator" />
							<li role="none">
								<ChatMenuDropdownItem
									role="menuitem"
									data-cy="tour-launcher-manage"
									icon={
										<TuneOutlinedIcon aria-hidden="true" />
									}
									title={translate('tour.launcher.manage')}
									onClick={() => {
										close();
										onManage();
									}}
								/>
							</li>
						</ul>
					</ChatMenuDropdown>
				</div>
			)}
			<button
				ref={fabRef}
				type="button"
				className="tourLauncher__fab"
				data-cy="tour-launcher-fab"
				aria-label={fabLabel}
				title={fabLabel}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={open ? menuId : undefined}
				onClick={toggle}
			>
				{open ? (
					<CloseGlyph
						className="tourLauncher__fabIcon"
						aria-hidden="true"
					/>
				) : (
					<HelpOutlineRoundedIcon
						className="tourLauncher__fabIcon"
						aria-hidden="true"
					/>
				)}
			</button>
		</div>
	);
};
