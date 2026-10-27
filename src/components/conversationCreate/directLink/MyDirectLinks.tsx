import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import { ReactComponent as ClockIcon } from '../../../resources/img/icons/clock.svg';
import { ReactComponent as EmptyIllustration } from '../../../resources/img/illustrations/termine-icon.svg';
import { copyTextToClipboard } from '../../../utils/clipboardHelpers';
import { Switch } from '../../Switch';
import { DirectLink } from './directLink';
import { DirectLinkMediumIcon } from './DirectLinkMediumIcon';
import './directLink.styles.scss';

interface MyDirectLinksProps {
	links: DirectLink[];
	/** Opens "Create chat" — links are created only there. */
	onCreate: () => void;
	onToggle: (id: string, active: boolean) => void;
	onShowQr: (link: DirectLink) => void;
	onCopy?: (url: string) => void | Promise<void>;
}

/**
 * #1795: the clock entry in the navigation. v1 lists the counsellor's direct
 * links with quick copy, QR and on/off; time windows come later. The empty
 * state follows the old "Terminübersicht".
 */
export const MyDirectLinks = ({
	links,
	onCreate,
	onToggle,
	onShowQr,
	onCopy = (url) => copyTextToClipboard(url)
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
				<button
					type="button"
					className="myDirectLinks__create"
					aria-label={t('directLink.list.create')}
					title={t('directLink.list.create')}
					onClick={onCreate}
				>
					<AddIcon aria-hidden />
				</button>
			</header>
			{links.length === 0 ? (
				<div className="myDirectLinks__empty">
					<EmptyIllustration aria-hidden />
					<p>{t('directLink.list.empty')}</p>
				</div>
			) : (
				<ul className="myDirectLinks__list">
					{links.map((link) => (
						<li
							key={link.id}
							className={`myDirectLinks__row${
								link.active ? '' : ' myDirectLinks__row--off'
							}`}
						>
							<span className="myDirectLinks__icon">
								<DirectLinkMediumIcon medium={link.medium} />
							</span>
							<span className="myDirectLinks__text">
								<span className="myDirectLinks__name">
									{link.name}
								</span>
								<span className="myDirectLinks__meta">
									{t(
										`directLink.medium.${link.medium.toLowerCase()}`
									)}{' '}
									· {link.topic}
									{link.temporary && (
										<span className="directLinkChip">
											{t('directLink.temporary')}
										</span>
									)}
								</span>
							</span>
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
									<ContentCopyOutlinedIcon aria-hidden />
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
							<Switch
								checked={link.active}
								onChange={(active) => onToggle(link.id, active)}
								aria-label={t('directLink.list.active', {
									name: link.name
								})}
							/>
						</li>
					))}
				</ul>
			)}
		</section>
	);
};
