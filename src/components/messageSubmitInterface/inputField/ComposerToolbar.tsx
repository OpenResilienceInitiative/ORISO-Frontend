import * as React from 'react';
import type { TFunction } from 'i18next';
import { useCallback, useRef, useState } from 'react';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import DataObjectIcon from '@mui/icons-material/DataObject';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import CodeIcon from '@mui/icons-material/Code';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import BorderColorOutlinedIcon from '@mui/icons-material/BorderColorOutlined';
import LinkIcon from '@mui/icons-material/Link';
import SuperscriptIcon from '@mui/icons-material/Superscript';
import SubscriptIcon from '@mui/icons-material/Subscript';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import DisabledByDefaultRoundedIcon from '@mui/icons-material/DisabledByDefaultRounded';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import ChecklistIcon from '@mui/icons-material/Checklist';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import { ToolbarButton, ToolbarDivider } from './ToolbarButton';
import { ToolbarMenu, ToolbarMenuItem } from './ToolbarMenu';
import type { MenuDirection } from './menuDirection';
import './composerToolbar.styles.scss';

export type ComposerToolbarMenu =
	| 'heading'
	| 'list'
	| 'highlight'
	| 'overflow'
	| null;

export interface ComposerToolbarProps {
	direction: MenuDirection;
	isMobile: boolean;
	isExpanded: boolean;
	onAction: (action: string) => void;
	isActionSelected: (action: string) => boolean;
	/** Collapse back to the default action bar (Figma close X). */
	onCollapse: () => void;
	onExpandToggle: () => void;
	translate: TFunction;
}

/**
 * Text-style menu (#995). The block styles are named the way a counsellor
 * thinks about them — "Titel", "Große Überschrift" — not by their H-level, and
 * the paragraph entry comes first so there is always a way back to body text.
 * `glyph` keeps the language-neutral letter shape of the Figma menu.
 */
const TEXT_STYLE_ENTRIES = [
	{
		action: 'paragraph',
		labelKey: 'paragraph',
		glyph: 'T'
	},
	{
		action: 'heading1',
		labelKey: 'heading1',
		glyph: 'H1'
	},
	{
		action: 'heading2',
		labelKey: 'heading2',
		glyph: 'H2'
	},
	{
		action: 'heading3',
		labelKey: 'heading3',
		glyph: 'H3'
	},
	{
		action: 'heading4',
		labelKey: 'heading4',
		glyph: 'H4'
	}
] as const;

/**
 * Full editor toolbar — Figma "Text Editor Menu Variants" (487:19879) and
 * "Tip Tap Menu" (7086:46390). Desktop shows every group; mobile shows the
 * compact set with the remaining actions in the kebab overflow menu. All
 * dropdown menus follow the Figma direction rule via `direction`.
 */
export const ComposerToolbar = ({
	direction,
	isMobile,
	isExpanded,
	onAction,
	isActionSelected,
	onCollapse,
	onExpandToggle,
	translate
}: ComposerToolbarProps) => {
	const [openMenu, setOpenMenu] = useState<ComposerToolbarMenu>(null);
	const anchorRefs = useRef<Record<string, HTMLSpanElement | null>>({});

	const toggleMenu = useCallback(
		(menu: Exclude<ComposerToolbarMenu, null>) =>
			setOpenMenu((current) => (current === menu ? null : menu)),
		[]
	);
	const closeMenu = useCallback(() => setOpenMenu(null), []);

	const textStyleItems: ToolbarMenuItem[] = TEXT_STYLE_ENTRIES.map(
		({ action, labelKey, glyph }) => ({
			key: action,
			label: translate(`message.submit.toolbar.${labelKey}`),
			glyph: <span className="composerToolbar__hGlyph">{glyph}</span>,
			selected: isActionSelected(action),
			exclusive: true,
			onSelect: () => onAction(action)
		})
	);

	const listItems: ToolbarMenuItem[] = [
		{
			key: 'bulletList',
			label: translate('message.submit.toolbar.bulletList'),
			glyph: <FormatListBulletedIcon fontSize="inherit" />,
			selected: isActionSelected('bulletList'),
			exclusive: true,
			onSelect: () => onAction('bulletList')
		},
		{
			key: 'orderedList',
			label: translate('message.submit.toolbar.orderedList'),
			glyph: <FormatListNumberedIcon fontSize="inherit" />,
			selected: isActionSelected('orderedList'),
			exclusive: true,
			onSelect: () => onAction('orderedList')
		},
		{
			key: 'taskList',
			label: translate('message.submit.toolbar.taskList'),
			glyph: <ChecklistIcon fontSize="inherit" />,
			selected: isActionSelected('taskList'),
			exclusive: true,
			onSelect: () => onAction('taskList')
		}
	];

	const highlightItems: ToolbarMenuItem[] = (
		[
			['highlightYellow', 'yellow'],
			['highlightOrange', 'orange'],
			['highlightRose', 'rose'],
			['highlightMint', 'mint'],
			['highlightBlue', 'blue']
		] as const
	).map(([action, swatch]) => ({
		key: action,
		label: translate(`message.submit.toolbar.${action}`),
		glyph: (
			<span
				className={`composerToolbar__swatch composerToolbar__swatch--${swatch}`}
			/>
		),
		onSelect: () => onAction(action)
	}));

	const overflowItems: ToolbarMenuItem[] = [
		{
			key: 'blockquote',
			label: translate('message.submit.toolbar.quote'),
			glyph: <FormatQuoteIcon fontSize="inherit" />,
			selected: isActionSelected('blockquote'),
			onSelect: () => onAction('blockquote')
		},
		{
			key: 'bold',
			label: translate('message.submit.toolbar.bold'),
			glyph: <FormatBoldIcon fontSize="inherit" />,
			selected: isActionSelected('bold'),
			onSelect: () => onAction('bold')
		},
		{
			key: 'italic',
			label: translate('message.submit.toolbar.italic'),
			glyph: <FormatItalicIcon fontSize="inherit" />,
			selected: isActionSelected('italic'),
			onSelect: () => onAction('italic')
		},
		{
			key: 'strike',
			label: translate('message.submit.toolbar.strike'),
			glyph: <StrikethroughSIcon fontSize="inherit" />,
			selected: isActionSelected('strike'),
			onSelect: () => onAction('strike')
		},
		{
			key: 'underline',
			label: translate('message.submit.toolbar.underline'),
			glyph: <FormatUnderlinedIcon fontSize="inherit" />,
			selected: isActionSelected('underline'),
			onSelect: () => onAction('underline')
		},
		{
			key: 'code',
			label: translate('message.submit.toolbar.code'),
			glyph: <CodeIcon fontSize="inherit" />,
			selected: isActionSelected('code'),
			onSelect: () => onAction('code')
		},
		{
			key: 'codeBlock',
			label: translate('message.submit.toolbar.codeBlock'),
			glyph: <DataObjectIcon fontSize="inherit" />,
			selected: isActionSelected('codeBlock'),
			onSelect: () => onAction('codeBlock')
		},
		{
			key: 'setLink',
			label: translate('message.submit.toolbar.link'),
			glyph: <LinkIcon fontSize="inherit" />,
			onSelect: () => onAction('setLink')
		},
		{
			key: 'insertImageMarker',
			label: translate('message.submit.toolbar.addImage'),
			glyph: <AddPhotoAlternateOutlinedIcon fontSize="inherit" />,
			onSelect: () => onAction('insertImageMarker')
		},
		{
			key: 'insertDateTime',
			label: translate('message.submit.toolbar.dateTime'),
			glyph: <EventOutlinedIcon fontSize="inherit" />,
			onSelect: () => onAction('insertDateTime')
		}
	];

	const MenuChevron =
		direction === 'up' ? KeyboardArrowUpIcon : KeyboardArrowDownIcon;

	const renderMenuAnchor = (
		menu: Exclude<ComposerToolbarMenu, null>,
		label: string,
		glyph: React.ReactNode,
		items: ToolbarMenuItem[],
		withChevron = true
	) => (
		<span
			className="composerToolbar__menuAnchor"
			ref={(el) => {
				anchorRefs.current[menu] = el;
			}}
		>
			<ToolbarButton
				label={label}
				onClick={() => toggleMenu(menu)}
				selected={openMenu === menu}
				expanded={openMenu === menu}
			>
				{glyph}
				{withChevron && (
					<MenuChevron
						className="composerToolbar__chevron"
						fontSize="inherit"
					/>
				)}
			</ToolbarButton>
			{openMenu === menu && (
				<ToolbarMenu
					items={items}
					direction={direction}
					onClose={closeMenu}
					ariaLabel={label}
					anchorEl={anchorRefs.current[menu]}
				/>
			)}
		</span>
	);

	return (
		<div className="composerToolbar" data-direction={direction}>
			<ToolbarButton
				label={translate('message.submit.toolbar.closeTools')}
				onClick={onCollapse}
			>
				<DisabledByDefaultRoundedIcon fontSize="inherit" />
			</ToolbarButton>
			<ToolbarDivider />
			<ToolbarButton
				label={translate('message.submit.toolbar.undo')}
				onClick={() => onAction('undo')}
			>
				<UndoIcon fontSize="inherit" />
			</ToolbarButton>
			<ToolbarButton
				label={translate('message.submit.toolbar.redo')}
				onClick={() => onAction('redo')}
			>
				<RedoIcon fontSize="inherit" />
			</ToolbarButton>
			<ToolbarDivider />
			{renderMenuAnchor(
				'heading',
				translate('message.submit.toolbar.heading'),
				<span className="composerToolbar__hGlyph">H</span>,
				textStyleItems
			)}
			{renderMenuAnchor(
				'list',
				translate('message.submit.toolbar.list'),
				<FormatListBulletedIcon fontSize="inherit" />,
				listItems
			)}
			{!isMobile && (
				<>
					<ToolbarButton
						label={translate('message.submit.toolbar.quote')}
						onClick={() => onAction('blockquote')}
						selected={isActionSelected('blockquote')}
					>
						<FormatQuoteIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarButton
						label={translate('message.submit.toolbar.codeBlock')}
						onClick={() => onAction('codeBlock')}
						selected={isActionSelected('codeBlock')}
					>
						<DataObjectIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarDivider />
					<ToolbarButton
						label={translate('message.submit.toolbar.bold')}
						onClick={() => onAction('bold')}
						selected={isActionSelected('bold')}
					>
						<FormatBoldIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarButton
						label={translate('message.submit.toolbar.italic')}
						onClick={() => onAction('italic')}
						selected={isActionSelected('italic')}
					>
						<FormatItalicIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarButton
						label={translate('message.submit.toolbar.strike')}
						onClick={() => onAction('strike')}
						selected={isActionSelected('strike')}
					>
						<StrikethroughSIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarButton
						label={translate('message.submit.toolbar.code')}
						onClick={() => onAction('code')}
						selected={isActionSelected('code')}
					>
						<CodeIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarButton
						label={translate('message.submit.toolbar.underline')}
						onClick={() => onAction('underline')}
						selected={isActionSelected('underline')}
					>
						<FormatUnderlinedIcon fontSize="inherit" />
					</ToolbarButton>
					{renderMenuAnchor(
						'highlight',
						translate('message.submit.toolbar.highlight'),
						<BorderColorOutlinedIcon fontSize="inherit" />,
						highlightItems,
						false
					)}
					<ToolbarButton
						label={translate('message.submit.toolbar.link')}
						onClick={() => onAction('setLink')}
					>
						<LinkIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarDivider />
					<ToolbarButton
						label={translate('message.submit.toolbar.superscript')}
						onClick={() => onAction('superscript')}
						selected={isActionSelected('superscript')}
					>
						<SuperscriptIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarButton
						label={translate('message.submit.toolbar.subscript')}
						onClick={() => onAction('subscript')}
						selected={isActionSelected('subscript')}
					>
						<SubscriptIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarDivider />
					<ToolbarButton
						label={translate('message.submit.toolbar.addImage')}
						onClick={() => onAction('insertImageMarker')}
						text={translate('message.submit.toolbar.addImageShort')}
					>
						<AddPhotoAlternateOutlinedIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarDivider />
				</>
			)}
			{isMobile &&
				renderMenuAnchor(
					'overflow',
					translate('message.submit.toolbar.more'),
					<MoreVertIcon fontSize="inherit" />,
					overflowItems,
					false
				)}
			<ToolbarButton
				label={translate(
					isExpanded
						? 'message.submit.toolbar.minimize'
						: 'message.submit.toolbar.maximize'
				)}
				onClick={onExpandToggle}
			>
				{isExpanded ? (
					<CloseFullscreenIcon fontSize="inherit" />
				) : (
					<OpenInFullIcon fontSize="inherit" />
				)}
			</ToolbarButton>
		</div>
	);
};
