import * as React from 'react';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { OrisoTextField } from '../form/OrisoTextField';
import { OrisoSelect, OrisoSelectOption } from '../form/OrisoSelect';
import { Switch } from '../Switch';
import { DirectLink } from '../conversationCreate/directLink/directLink';
import { DirectLinkMediumIcon } from '../conversationCreate/directLink/DirectLinkMediumIcon';
import { DirectLinkUpdate } from '../../api/apiDirectLinks';
import './myDirectLinksPage.styles.scss';

export const DIRECT_LINK_NAME_MAX = 100;

interface DirectLinkEditDialogProps {
	link: DirectLink | null;
	/** The counsellor's topics for the link's agency; value = topic id. */
	topics: OrisoSelectOption[];
	saving?: boolean;
	failed?: boolean;
	fullScreen?: boolean;
	onClose: () => void;
	onSave: (link: DirectLink, update: DirectLinkUpdate) => void;
}

/**
 * #1894: edit name, topic and the temporary switch of a direct link.
 * The medium is fixed after creation (UserService#1479), so it only shows.
 */
export const DirectLinkEditDialog = ({
	link,
	topics,
	saving = false,
	failed = false,
	fullScreen = false,
	onClose,
	onSave
}: DirectLinkEditDialogProps) => {
	const { t } = useTranslation();
	const id = useId();
	const [name, setName] = useState('');
	const [topicId, setTopicId] = useState('');
	const [temporary, setTemporary] = useState(false);

	useEffect(() => {
		if (!link) return;
		setName(link.name);
		setTopicId(link.topicId != null ? String(link.topicId) : '');
		setTemporary(link.temporary);
	}, [link]);

	if (!link) return null;

	const trimmed = name.trim();
	const update: DirectLinkUpdate = {};
	if (trimmed !== link.name) update.name = trimmed;
	if (topicId && topicId !== String(link.topicId ?? ''))
		update.topicId = Number(topicId);
	if (temporary !== link.temporary) update.temporary = temporary;
	const changed = Object.keys(update).length > 0;
	const valid = trimmed.length > 0 && trimmed.length <= DIRECT_LINK_NAME_MAX;

	return (
		<M3Dialog
			open
			onClose={onClose}
			fullScreen={fullScreen}
			width={480}
			closeLabel={t('app.close')}
			icon={<EditOutlinedIcon />}
			title={t('directLink.edit.title')}
			className="directLinkEditDialog"
			data-testid="direct-link-edit-dialog"
			actions={[
				{ label: t('directLink.edit.cancel'), onClick: onClose },
				{
					label: t('directLink.edit.save'),
					onClick: () => onSave(link, update),
					primary: true,
					disabled: !changed || !valid || saving,
					testId: 'direct-link-edit-save'
				}
			]}
		>
			<div className="directLinkEditDialog__body">
				<div className="directLinkEditDialog__medium">
					<DirectLinkMediumIcon medium={link.medium} />
					<span>
						{t(`directLink.medium.${link.medium.toLowerCase()}`)}
					</span>
					<span className="directLinkEditDialog__fixed">
						{t('directLink.edit.mediumFixed')}
					</span>
				</div>
				<OrisoTextField
					id={`${id}-name`}
					label={t('directLink.edit.name')}
					value={name}
					onChange={(event) => setName(event.target.value)}
					error={!valid}
					helperText={
						trimmed.length === 0
							? t('directLink.edit.nameRequired')
							: `${trimmed.length} / ${DIRECT_LINK_NAME_MAX}`
					}
					inputProps={{ maxLength: DIRECT_LINK_NAME_MAX }}
					fullWidth
				/>
				{topics.length > 1 && (
					<OrisoSelect
						id={`${id}-topic`}
						label={t('directLink.edit.topic')}
						options={topics}
						value={topicId}
						onChange={(event) => setTopicId(event.target.value)}
					/>
				)}
				<div className="directLinkEditDialog__switchRow">
					<div>
						<span
							id={`${id}-temp`}
							className="directLinkEditDialog__switchLabel"
						>
							{t('directLink.card.temporary')}
						</span>
						<span
							id={`${id}-temp-hint`}
							className="directLinkEditDialog__hint"
						>
							{t('directLink.edit.temporaryHint')}
						</span>
					</div>
					<Switch
						checked={temporary}
						onChange={setTemporary}
						aria-labelledby={`${id}-temp`}
						aria-describedby={`${id}-temp-hint`}
					/>
				</div>
				{failed && (
					<p role="alert" className="directLinkEditDialog__error">
						{t('directLink.edit.failed')}
					</p>
				)}
			</div>
		</M3Dialog>
	);
};
