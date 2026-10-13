import * as React from 'react';
import { useContext, useState } from 'react';
import { IconButton, ListItemIcon, Menu, MenuItem } from '@mui/material';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import { useTranslation } from 'react-i18next';
import LegalLinks from '../../legalLinks/LegalLinks';
import { LegalLinkMenuIcon } from '../../legalLinks/LegalLinkMenuIcon';
import { LegalLinkModal } from '../../legalLinks/LegalLinkModal';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import type { GroupDepartment } from '../consent/useGroupDepartment';

/**
 * Datenschutz and Impressum from a menu, the way every chat room offers them
 * (#1499, Frank 23.09.2026). On a phone the stage prints no legal links, so the
 * group's waiting room would otherwise have none at all. The documents are the
 * ones of the Beratungsstelle that runs the group when its department is
 * known, else the Träger's.
 */
export const GroupLegalMenu = ({
	department
}: {
	department: GroupDepartment | null;
}) => {
	const { t } = useTranslation();
	const legalLinks = useContext(LegalLinksContext);
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const [open, setOpen] = useState<{
		title: string;
		url: string;
		rawLabel: string;
	} | null>(null);
	const label = t('groupChat.entry.legalMenu', 'Rechtliches');

	if (!legalLinks?.length) {
		return null;
	}

	return (
		<>
			<IconButton
				aria-label={label}
				title={label}
				aria-haspopup="menu"
				aria-expanded={Boolean(anchor)}
				data-cy="group-entry-legal-menu"
				onClick={(event) => setAnchor(event.currentTarget)}
				sx={{
					'width': 34,
					'height': 34,
					'color': 'var(--m3-on-primary, #fff)',
					'backgroundColor': 'rgba(255, 255, 255, 0.14)',
					'&:hover': {
						backgroundColor: 'rgba(255, 255, 255, 0.24)'
					}
				}}
			>
				<MoreVertRoundedIcon fontSize="small" />
			</IconButton>
			<Menu
				anchorEl={anchor}
				open={Boolean(anchor)}
				onClose={() => setAnchor(null)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
				transformOrigin={{ vertical: 'top', horizontal: 'right' }}
			>
				<LegalLinks
					legalLinks={legalLinks}
					params={{ aid: department?.agencyId ?? null }}
				>
					{(title, url, rawLabel) => (
						<MenuItem
							onClick={() => {
								setAnchor(null);
								setOpen({ title, url, rawLabel });
							}}
						>
							<ListItemIcon>
								<LegalLinkMenuIcon
									title={title}
									url={url}
									rawLabel={rawLabel}
								/>
							</ListItemIcon>
							{title}
						</MenuItem>
					)}
				</LegalLinks>
			</Menu>
			{open && (
				<LegalLinkModal
					title={open.title}
					rawLabel={open.rawLabel}
					url={open.url}
					onClose={() => setOpen(null)}
					{...(department
						? {
								scope: 'agency' as const,
								agencyId: department.agencyId,
								topicId: department.topicId
							}
						: {})}
				/>
			)}
		</>
	);
};
