import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { ReactComponent as ClockIcon } from '../../../resources/img/icons/clock.svg';
import { FORMAT_ARTWORK } from '../../../resources/img/formats';
import { copyTextToClipboard } from '../../../utils/clipboardHelpers';
import { Switch } from '../../Switch';
import { ArtworkImage } from '../ArtworkImage';
import { DirectLink } from './directLink';
import { DirectLinkMediumIcon } from './DirectLinkMediumIcon';
import './directLink.styles.scss';

interface MyDirectLinksProps {
	links: DirectLink[];
	onToggle: (id: string, active: boolean) => void;
	onShowQr: (link: DirectLink) => void;
	onCopy?: (url: string) => void | Promise<void>;
	/** #1894: edit name, topic and the temporary switch. */
	onEdit?: (link: DirectLink) => void;
	/** #1894: e.g. the round "Create chat" button, right of the title. */
	headerAction?: React.ReactNode;
	/** #1894: shown instead of the grid while there are no links. */
	emptyState?: React.ReactNode;
}

/**
 * #1795: the counsellor's direct links as illustrated tiles with quick copy,
 * QR and on/off. Links are created only in "Create chat"; time windows come later.
 */
export const MyDirectLinks = ({
	links,
	onToggle,
	onShowQr,
	onCopy = (url) => copyTextToClipboard(url),
	onEdit,
	headerAction,
	emptyState
}: MyDirectLinksProps) => {
	const { t } = useTranslation();
	const [copiedId, setCopiedId] = useState<string>();

	return (
		<section className="myDirectLinks" aria-labelledby="myDirectLinksTitle">
			<header className="myDirectLinks__header">
				<ClockIcon aria-hidden className="myDirectLinks__headerIcon" />
				<h2 id="myDirectLinksTitle" className="myDirectLinks__title">
					{t('directLink.list.title')}
				</h2>
				{headerAction && (
					<div className="myDirectLinks__headerAction">
						{headerAction}
					</div>
				)}
			</header>
			{links.length === 0 && emptyState ? (
				emptyState
			) : (
				<ul className="myDirectLinks__grid">
					{links.map((link) => (
						<li
							key={link.id}
							className={`directLinkTile${
								link.active ? '' : ' directLinkTile--off'
							}`}
						>
							<div className="directLinkTile__media">
								<ArtworkImage
									artwork={FORMAT_ARTWORK[link.medium]}
									alt=""
									aria-hidden
									className="directLinkTile__image"
									sizes="320px"
								/>
								<span className="directLinkTile__badge">
									<DirectLinkMediumIcon
										medium={link.medium}
										filled
									/>
									{t(
										`directLink.medium.${link.medium.toLowerCase()}`
									)}
								</span>
							</div>
							<div className="directLinkTile__body">
								<span className="directLinkTile__name">
									{link.name}
								</span>
								<span className="directLinkTile__meta">
									{link.topic}
									{link.temporary && (
										<span className="directLinkChip">
											{t('directLink.temporary')}
										</span>
									)}
								</span>
								<div className="directLinkTile__actions">
									<button
										type="button"
										className="myDirectLinks__iconButton"
										aria-label={t('directLink.copy')}
										title={t('directLink.copy')}
										disabled={!link.active}
										onClick={async () => {
											await onCopy(link.url);
											setCopiedId(link.id);
										}}
									>
										{copiedId === link.id ? (
											<CheckOutlinedIcon aria-hidden />
										) : (
											<ContentCopyOutlinedIcon
												aria-hidden
											/>
										)}
									</button>
									<button
										type="button"
										className="myDirectLinks__iconButton"
										aria-label={t('directLink.list.qr')}
										title={t('directLink.list.qr')}
										disabled={!link.active}
										onClick={() => onShowQr(link)}
									>
										<QrCode2OutlinedIcon aria-hidden />
									</button>
									{onEdit && (
										<button
											type="button"
											className="myDirectLinks__iconButton"
											aria-label={t(
												'directLink.list.edit',
												{
													name: link.name
												}
											)}
											title={t('directLink.edit.title')}
											onClick={() => onEdit(link)}
										>
											<EditOutlinedIcon aria-hidden />
										</button>
									)}
									<Switch
										checked={link.active}
										onChange={(active) =>
											onToggle(link.id, active)
										}
										aria-label={t(
											'directLink.list.active',
											{
												name: link.name
											}
										)}
									/>
								</div>
							</div>
						</li>
					))}
				</ul>
			)}
		</section>
	);
};
