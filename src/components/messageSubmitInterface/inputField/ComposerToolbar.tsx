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

const HEADING_LEVELS = [1, 2, 3, 4] as const;

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

	const headingItems: ToolbarMenuItem[] = HEADING_LEVELS.map((level) => ({
		key: `heading${level}`,
		label: translate(
			`message.submit.toolbar.heading${level}`,
			`Heading ${level}`
		),
		glyph: <span className="composerToolbar__hGlyph">H{level}</span>,
		selected: isActionSelected(`heading${level}`),
		onSelect: () => onAction(`heading${level}`)
	}));

	const listItems: ToolbarMenuItem[] = [
		{
			key: 'bulletList',
			label: translate(
				'message.submit.toolbar.bulletList',
				'Bullet List'
			),
			glyph: <FormatListBulletedIcon fontSize="inherit" />,
			selected: isActionSelected('bulletList'),
			onSelect: () => onAction('bulletList')
		},
		{
			key: 'orderedList',
			label: translate(
				'message.submit.toolbar.orderedList',
				'Ordered List'
			),
			glyph: <FormatListNumberedIcon fontSize="inherit" />,
			selected: isActionSelected('orderedList'),
			onSelect: () => onAction('orderedList')
		},
		{
			key: 'taskList',
			label: translate('message.submit.toolbar.taskList', 'Task List'),
			glyph: <ChecklistIcon fontSize="inherit" />,
			selected: isActionSelected('taskList'),
			onSelect: () => onAction('taskList')
		}
	];

	const highlightItems: ToolbarMenuItem[] = (
		[
			['highlightYellow', 'Yellow'],
			['highlightOrange', 'Orange'],
			['highlightRose', 'Rose'],
			['highlightMint', 'Mint'],
			['highlightBlue', 'Blue']
		] as const
	).map(([action, fallback]) => ({
		key: action,
		label: translate(`message.submit.toolbar.${action}`, fallback),
		glyph: (
			<span
				className={`composerToolbar__swatch composerToolbar__swatch--${fallback.toLowerCase()}`}
			/>
		),
		onSelect: () => onAction(action)
	}));

	const overflowItems: ToolbarMenuItem[] = [
		{
			key: 'blockquote',
			label: translate('message.submit.toolbar.quote', 'Quote'),
			glyph: <FormatQuoteIcon fontSize="inherit" />,
			selected: isActionSelected('blockquote'),
			onSelect: () => onAction('blockquote')
		},
		{
			key: 'bold',
			label: translate('message.submit.toolbar.bold', 'Bold'),
			glyph: <FormatBoldIcon fontSize="inherit" />,
			selected: isActionSelected('bold'),
			onSelect: () => onAction('bold')
		},
		{
			key: 'italic',
			label: translate('message.submit.toolbar.italic', 'Italic'),
			glyph: <FormatItalicIcon fontSize="inherit" />,
			selected: isActionSelected('italic'),
			onSelect: () => onAction('italic')
		},
		{
			key: 'strike',
			label: translate('message.submit.toolbar.strike', 'Strikethrough'),
			glyph: <StrikethroughSIcon fontSize="inherit" />,
			selected: isActionSelected('strike'),
			onSelect: () => onAction('strike')
		},
		{
			key: 'underline',
			label: translate('message.submit.toolbar.underline', 'Underline'),
			glyph: <FormatUnderlinedIcon fontSize="inherit" />,
			selected: isActionSelected('underline'),
			onSelect: () => onAction('underline')
		},
		{
			key: 'code',
			label: translate('message.submit.toolbar.code', 'Inline code'),
			glyph: <CodeIcon fontSize="inherit" />,
			selected: isActionSelected('code'),
			onSelect: () => onAction('code')
		},
		{
			key: 'codeBlock',
			label: translate('message.submit.toolbar.codeBlock', 'Code block'),
			glyph: <DataObjectIcon fontSize="inherit" />,
			selected: isActionSelected('codeBlock'),
			onSelect: () => onAction('codeBlock')
		},
		{
			key: 'setLink',
			label: translate('message.submit.toolbar.link', 'Link'),
			glyph: <LinkIcon fontSize="inherit" />,
			onSelect: () => onAction('setLink')
		},
		{
			key: 'insertImageMarker',
			label: translate('message.submit.toolbar.addImage', 'Add image'),
			glyph: <AddPhotoAlternateOutlinedIcon fontSize="inherit" />,
			onSelect: () => onAction('insertImageMarker')
		},
		{
			key: 'insertDateTime',
			label: translate(
				'message.submit.toolbar.dateTime',
				'Insert date time'
			),
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
				label={translate(
					'message.submit.toolbar.closeTools',
					'Switch to compact tools'
				)}
				onClick={onCollapse}
			>
				<DisabledByDefaultRoundedIcon fontSize="inherit" />
			</ToolbarButton>
			<ToolbarDivider />
			<ToolbarButton
				label={translate('message.submit.toolbar.undo', 'Undo')}
				onClick={() => onAction('undo')}
			>
				<UndoIcon fontSize="inherit" />
			</ToolbarButton>
			<ToolbarButton
				label={translate('message.submit.toolbar.redo', 'Redo')}
				onClick={() => onAction('redo')}
			>
				<RedoIcon fontSize="inherit" />
			</ToolbarButton>
			<ToolbarDivider />
			{renderMenuAnchor(
				'heading',
				translate('message.submit.toolbar.heading', 'Heading style'),
				<span className="composerToolbar__hGlyph">H</span>,
				headingItems
			)}
			{renderMenuAnchor(
				'list',
				translate('message.submit.toolbar.list', 'List style'),
				<FormatListBulletedIcon fontSize="inherit" />,
				listItems
			)}
			{!isMobile && (
				<>
					<ToolbarButton
						label={translate(
							'message.submit.toolbar.quote',
							'Quote'
						)}
						onClick={() => onAction('blockquote')}
						selected={isActionSelected('blockquote')}
					>
						<FormatQuoteIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarButton
						label={translate(
							'message.submit.toolbar.codeBlock',
							'Code block'
						)}
						onClick={() => onAction('codeBlock')}
						selected={isActionSelected('codeBlock')}
					>
						<DataObjectIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarDivider />
					<ToolbarButton
						label={translate('message.submit.toolbar.bold', 'Bold')}
						onClick={() => onAction('bold')}
						selected={isActionSelected('bold')}
					>
						<FormatBoldIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarButton
						label={translate(
							'message.submit.toolbar.italic',
							'Italic'
						)}
						onClick={() => onAction('italic')}
						selected={isActionSelected('italic')}
					>
						<FormatItalicIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarButton
						label={translate(
							'message.submit.toolbar.strike',
							'Strikethrough'
						)}
						onClick={() => onAction('strike')}
						selected={isActionSelected('strike')}
					>
						<StrikethroughSIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarButton
						label={translate(
							'message.submit.toolbar.code',
							'Inline code'
						)}
						onClick={() => onAction('code')}
						selected={isActionSelected('code')}
					>
						<CodeIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarButton
						label={translate(
							'message.submit.toolbar.underline',
							'Underline'
						)}
						onClick={() => onAction('underline')}
						selected={isActionSelected('underline')}
					>
						<FormatUnderlinedIcon fontSize="inherit" />
					</ToolbarButton>
					{renderMenuAnchor(
						'highlight',
						translate(
							'message.submit.toolbar.highlight',
							'Highlight'
						),
						<BorderColorOutlinedIcon fontSize="inherit" />,
						highlightItems,
						false
					)}
					<ToolbarButton
						label={translate('message.submit.toolbar.link', 'Link')}
						onClick={() => onAction('setLink')}
					>
						<LinkIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarDivider />
					<ToolbarButton
						label={translate(
							'message.submit.toolbar.superscript',
							'Superscript'
						)}
						onClick={() => onAction('superscript')}
						selected={isActionSelected('superscript')}
					>
						<SuperscriptIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarButton
						label={translate(
							'message.submit.toolbar.subscript',
							'Subscript'
						)}
						onClick={() => onAction('subscript')}
						selected={isActionSelected('subscript')}
					>
						<SubscriptIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarDivider />
					<ToolbarButton
						label={translate(
							'message.submit.toolbar.addImage',
							'Add image'
						)}
						onClick={() => onAction('insertImageMarker')}
						text={translate(
							'message.submit.toolbar.addImageShort',
							'Add'
						)}
					>
						<AddPhotoAlternateOutlinedIcon fontSize="inherit" />
					</ToolbarButton>
					<ToolbarDivider />
				</>
			)}
			{isMobile &&
				renderMenuAnchor(
					'overflow',
					translate('message.submit.toolbar.more', 'More tools'),
					<MoreVertIcon fontSize="inherit" />,
					overflowItems,
					false
				)}
			<ToolbarButton
				label={translate(
					isExpanded
						? 'message.submit.toolbar.minimize'
						: 'message.submit.toolbar.maximize',
					isExpanded ? 'Minimize editor' : 'Maximize editor'
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
