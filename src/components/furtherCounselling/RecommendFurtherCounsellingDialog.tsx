import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Alert,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
	TextField
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import { Button, BUTTON_TYPES, ButtonItem } from '../button/Button';
import { OrisoSelect, OrisoSelectOption } from '../form/OrisoSelect';
import { apiGetTopicsData } from '../../api/apiGetTopicsData';
import { apiPostFurtherCounsellingRecommendation } from '../../api/apiFurtherCounselling';
import { FETCH_ERRORS } from '../../api/fetchData';
import { TopicsDataInterface } from '../../globalState/interfaces';
import { getRegistrationTopicDisplay } from '../registration/registrationDesign/registrationDesign';
import { FURTHER_COUNSELLING_NOTE_MAX_LENGTH } from './furtherCounsellingNotices';

export interface RecommendFurtherCounsellingDialogProps {
	open: boolean;
	sessionId: number;
	onClose: () => void;
	/** The backend accepted the recommendation and posted the card. */
	onSent: () => void;
}

const errorKey = (error: unknown): string => {
	const message = error instanceof Error ? error.message : '';
	if (message === FETCH_ERRORS.FORBIDDEN)
		return 'furtherCounselling.recommend.errorForbidden';
	if (message === FETCH_ERRORS.CONFLICT)
		return 'furtherCounselling.recommend.errorConflict';
	return 'furtherCounselling.recommend.error';
};

/**
 * FE#1876: the assigned counsellor picks a topic (the registration catalogue,
 * current topic included) and may add a note. The backend posts the card.
 */
export const RecommendFurtherCounsellingDialog = ({
	open,
	sessionId,
	onClose,
	onSent
}: RecommendFurtherCounsellingDialogProps) => {
	const { t: translate, i18n } = useTranslation();
	const [topics, setTopics] = useState<TopicsDataInterface[]>([]);
	const [topicsFailed, setTopicsFailed] = useState(false);
	const [topicId, setTopicId] = useState('');
	const [note, setNote] = useState('');
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		let active = true;
		apiGetTopicsData()
			.then((response) => {
				if (!active) return;
				setTopics(response ?? []);
				setTopicsFailed(false);
			})
			.catch(() => active && setTopicsFailed(true));
		return () => {
			active = false;
		};
	}, [open]);

	const topicOptions: OrisoSelectOption[] = topics
		.map((topic) => ({
			value: topic.id.toString(),
			label:
				getRegistrationTopicDisplay(topic, i18n?.language)?.title ||
				topic.name
		}))
		.sort((a, b) => a.label.localeCompare(b.label));

	const submit = () => {
		if (!topicId || sending) return;
		setSending(true);
		setError(null);
		apiPostFurtherCounsellingRecommendation(
			sessionId,
			Number(topicId),
			note.trim() || undefined
		)
			.then(() => {
				setSending(false);
				onSent();
			})
			.catch((failure) => {
				setSending(false);
				setError(errorKey(failure));
			});
	};

	const submitButton: ButtonItem = {
		label: translate('furtherCounselling.recommend.submit'),
		type: BUTTON_TYPES.PRIMARY
	};
	const cancelButton: ButtonItem = {
		label: translate('furtherCounselling.recommend.cancel'),
		type: BUTTON_TYPES.SECONDARY
	};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			fullWidth
			maxWidth="sm"
			aria-labelledby="recommend-further-counselling-title"
			data-cy="recommend-further-counselling-dialog"
		>
			<DialogTitle id="recommend-further-counselling-title">
				{translate('furtherCounselling.recommend.title')}
			</DialogTitle>
			<DialogContent
				sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
			>
				<DialogContentText>
					{translate('furtherCounselling.recommend.intro')}
				</DialogContentText>
				{topicsFailed && (
					<Alert severity="error">
						{translate(
							'furtherCounselling.recommend.topicsUnavailable'
						)}
					</Alert>
				)}
				<OrisoSelect
					id="recommendTopicSelect"
					label={translate('furtherCounselling.recommend.topicLabel')}
					options={topicOptions}
					value={topicId}
					onChange={(event: SelectChangeEvent<string>) =>
						setTopicId(event.target.value)
					}
				/>
				<TextField
					id="recommendNote"
					label={translate('furtherCounselling.recommend.noteLabel')}
					multiline
					minRows={3}
					value={note}
					onChange={(event) =>
						setNote(
							event.target.value.slice(
								0,
								FURTHER_COUNSELLING_NOTE_MAX_LENGTH
							)
						)
					}
					inputProps={{
						maxLength: FURTHER_COUNSELLING_NOTE_MAX_LENGTH
					}}
					helperText={
						<span
							style={{
								display: 'flex',
								justifyContent: 'space-between',
								gap: 8
							}}
						>
							<span>
								{translate(
									'furtherCounselling.recommend.noteHint'
								)}
							</span>
							<span aria-live="polite">
								{translate(
									'furtherCounselling.recommend.noteCounter',
									{
										count: note.length,
										max: FURTHER_COUNSELLING_NOTE_MAX_LENGTH
									}
								)}
							</span>
						</span>
					}
				/>
				{error && (
					<Alert severity="error" role="alert">
						{translate(error)}
					</Alert>
				)}
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
				<Button item={cancelButton} buttonHandle={onClose} />
				<Button
					item={submitButton}
					buttonHandle={submit}
					disabled={!topicId || sending}
					testingAttribute="recommend-further-counselling-submit"
				/>
			</DialogActions>
		</Dialog>
	);
};
