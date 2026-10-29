import { getCounsellingDpaFailure } from '../../../api/counsellingDpaFailure';
import * as React from 'react';
import { useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	Alert,
	Box,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
	IconButton,
	Typography
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { SelectChangeEvent } from '@mui/material/Select';
import { UserDataContext } from '../../../globalState';
import { Button, ButtonItem, BUTTON_TYPES } from '../../button/Button';
import { OrisoSelect, OrisoSelectOption } from '../../form/OrisoSelect';
import { Overlay, OVERLAY_FUNCTIONS, OverlayItem } from '../../overlay/Overlay';
import { mobileListView } from '../../app/navigationHandler';
import { useTranslation } from 'react-i18next';
import { ReactComponent as XIcon } from '../../../resources/img/illustrations/x.svg';
import { AdditionalAgencySelection } from '../AdditionalEnquiry/AdditionalAgencySelection';
import { apiPostAdditionalEnquiry, FETCH_ERRORS, X_REASON } from '../../../api';
import { apiGetTopicsData } from '../../../api/apiGetTopicsData';
import { TopicsDataInterface } from '../../../globalState/interfaces';
import { getRegistrationTopicDisplay } from '../../registration/registrationDesign/registrationDesign';
import { apiPutSessionConsent } from '../../../api/apiPutSessionConsent';
import { ConsentCompletionPanel } from '../../registration/consentCompletion/ConsentCompletionPanel';
import { DataProtectionConsentLabel } from '../../registration/accountData/DataProtectionConsentLabel';
import { useRequestConsentGate } from './useRequestConsentGate';

export interface NewRequestDialogProps {
	open: boolean;
	onClose: () => void;
	/** Preselect a topic (e.g. suggested by a consultant) - user can change it. */
	preselectedTopicId?: number;
	/** Prefill the postcode input - user can change it. */
	prefilledPostcode?: string;
	/** Agencies the asker is already in contact with; listed first + badged. */
	knownAgencyIds?: number[];
	/** Told once the enquiry exists, before the dialog navigates into it. */
	onRequestCreated?: (sessionId: number) => void;
}

/**
 * Reusable "start a request on another topic" pop-up. Used on the asker
 * profile public-data page and from the counsellor's recommendation card in
 * the chat (FE#1876, preselected topic). Creates a new enquiry via
 * POST /users/askers/session/new - no re-register.
 *
 * "Beratung anfragen" first slides up the consent of the chosen centre
 * (ADR-022 gate 2, moved forward, also for a centre the asker already knows).
 * Only a confirmed consent creates the session; it is then pinned to the
 * department version and the asker lands straight in the new enquiry.
 */
export const NewRequestDialog = ({
	open,
	onClose,
	preselectedTopicId,
	prefilledPostcode,
	knownAgencyIds,
	onRequestCreated
}: NewRequestDialogProps) => {
	const { t: translate, i18n } = useTranslation([
		'common',
		'consultingTypes'
	]);
	const navigate = useNavigate();

	const { reloadUserData } = useContext(UserDataContext);
	const [isButtonDisabled, setIsButtonDisabled] = useState(true);
	const [selectedTopicId, setSelectedTopicId] = useState<number>(
		preselectedTopicId ?? null
	);
	const [selectedAgency, setSelectedAgency] = useState<any>({});
	const [selectedPostcode, setSelectedPostcode] = useState<any>('');
	const [overlayActive, setOverlayActive] = useState(false);
	const [overlayItem, setOverlayItem] = useState<OverlayItem>(null);
	const [consentStep, setConsentStep] = useState(false);
	const consentInputRef = useRef<HTMLInputElement>(null);
	const [dpaFailure, setDpaFailure] =
		useState<ReturnType<typeof getCounsellingDpaFailure>>(null);
	const [isRequestInProgress, setIsRequestInProgress] = useState(false);
	const [topics, setTopics] = useState<TopicsDataInterface[]>([]);
	const [currentSelectOption, setCurrentSelectOption] = useState(
		preselectedTopicId != null ? preselectedTopicId.toString() : ''
	);

	const buttonSetRegistration: ButtonItem = {
		label: translate('profile.data.register.button.label'),
		type: BUTTON_TYPES.PRIMARY
	};

	const buttonCancel: ButtonItem = {
		label: translate('furtherCounselling.request.cancel'),
		type: BUTTON_TYPES.SECONDARY
	};

	const overlayItemNewRegistrationError: OverlayItem = {
		svg: XIcon,
		illustrationBackground: 'error',
		headline: translate('profile.data.registerError.overlay.headline'),
		buttonSet: [
			{
				label: translate(
					'profile.data.registerError.overlay.button.label'
				),
				function: OVERLAY_FUNCTIONS.CLOSE,
				type: BUTTON_TYPES.PRIMARY
			}
		]
	};

	useEffect(() => {
		if (!open) {
			return;
		}
		// The same topic list the registration offers (ORISO-Frontend#1655). The
		// agency-topics endpoint lists only topics of centres that are online,
		// so a Träger with one online centre offered one topic; whether a centre
		// serves the topic at the postcode is answered in the next step.
		apiGetTopicsData()
			.then((response) => {
				setTopics(response);
				// keep the pre-dev behaviour: a single available topic is
				// selected right away (unless a preselection was passed in)
				if (preselectedTopicId == null && response.length === 1) {
					const onlyTopicId = response[0].id;
					setSelectedTopicId(onlyTopicId);
					setCurrentSelectOption(onlyTopicId.toString());
				}
			})
			.catch(() => {
				setTopics([]);
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const isAllRequiredDataSet = () =>
		selectedTopicId != null && selectedAgency && selectedPostcode;

	useEffect(() => {
		setIsButtonDisabled(!isAllRequiredDataSet());
	}, [selectedAgency]); // eslint-disable-line react-hooks/exhaustive-deps

	const selectedTopic =
		topics.find((topic) => topic.id === selectedTopicId) ?? null;
	const consentAgency = selectedAgency?.id ? selectedAgency : null;
	const consent = useRequestConsentGate(consentAgency, selectedTopic);

	/* A changed centre, topic or postcode is a different request: the consent
	   on offer belonged to the previous one, so it retracts. */
	useEffect(() => {
		setConsentStep(false);
		consent.reset();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedAgency?.id, selectedTopicId, selectedPostcode]);

	useEffect(() => {
		if (consentStep && consent.isResolved) {
			consentInputRef.current?.focus();
		}
	}, [consentStep, consent.isResolved]);

	const handleConsultingTypeSelect = (event: SelectChangeEvent<string>) => {
		const topicId = event.target.value;
		setSelectedTopicId(parseInt(topicId));
		setCurrentSelectOption(topicId);
	};

	// Named as in the registration, in the reader's language.
	const topicOptions: OrisoSelectOption[] = topics
		.map((topic) => ({
			value: topic.id.toString(),
			label: getRegistrationTopicDisplay(topic, i18n?.language).title
		}))
		.sort((a, b) => a.label.localeCompare(b.label));

	const openNewEnquiry = (newSessionId?: number) => {
		reloadUserData().catch(() => {
			// non-fatal: the next mount refetches user data anyway
		});
		if (newSessionId != null) onRequestCreated?.(newSessionId);
		mobileListView();
		onClose();
		/* Normal session view (same screen consultants see from the enquiry
		   list) rather than the /write/ formulation helper. */
		navigate({
			pathname:
				newSessionId != null
					? `/sessions/user/view/session/${newSessionId}`
					: `/sessions/user/view`
		});
	};

	const handleRegistration = () => {
		if (isRequestInProgress || !isAllRequiredDataSet()) {
			return;
		}
		if (!consentStep) {
			setConsentStep(true);
			return;
		}
		// Fail closed: no session without the confirmed consent on screen.
		if (!consent.accepted) {
			consentInputRef.current?.focus();
			return;
		}
		const versionId = consent.versionId;
		setIsRequestInProgress(true);

		apiPostAdditionalEnquiry(
			selectedAgency.consultingType,
			selectedAgency.id,
			selectedPostcode,
			selectedTopicId
		).then(
			async (response) => {
				/* Pin the agreement to the department version that was on
				   screen (ADR-022). Best effort: the enquiry exists already,
				   and Träger or platform wording carries no version. */
				if (versionId !== null && response?.sessionId != null) {
					try {
						await apiPutSessionConsent(
							response.sessionId,
							versionId
						);
					} catch {
						/* the enquiry stands; the pointer is a refinement */
					}
				}
				setIsRequestInProgress(false);
				openNewEnquiry(response?.sessionId);
			},
			(error: Response) => {
				const failure = getCounsellingDpaFailure(error);
				setDpaFailure(failure);
				if (failure) {
					setOverlayItem({
						...overlayItemNewRegistrationError,
						headline: translate(`${failure.key}.title`),
						copy: translate(`${failure.key}.text`)
					});
					setIsButtonDisabled(false);
					setOverlayActive(true);
					setIsRequestInProgress(false);
					return;
				}
				const reason = error.headers?.get(FETCH_ERRORS.X_REASON);
				if (
					reason ===
					X_REASON.USER_ALREADY_REGISTERED_WITH_AGENCY_AND_TOPIC
				) {
					// clone - never mutate the shared overlay item object
					setOverlayItem({
						...overlayItemNewRegistrationError,
						headline: translate(
							'profile.data.registerError.overlay.xReasonAlreadyRegistered'
						)
					});
				} else {
					setOverlayItem(overlayItemNewRegistrationError);
				}
				setIsButtonDisabled(true);
				setOverlayActive(true);
				setIsRequestInProgress(false);
			}
		);
	};

	const handleOverlayAction = (buttonFunction: string) => {
		if (buttonFunction === OVERLAY_FUNCTIONS.CLOSE) {
			setOverlayItem(null);
			setOverlayActive(false);
			if (!dpaFailure) setSelectedTopicId(preselectedTopicId ?? null);
			setDpaFailure(null);
		}
	};

	// The error overlay is portalled below the MUI dialog (z-index 55 against
	// 1300), so the dialog steps aside while it shows: otherwise the advice
	// seeker never sees it or its button (ORISO-Frontend#1655).
	const showOverlay = overlayActive && !dpaFailure;

	return (
		<>
			<Dialog
				open={open && !showOverlay}
				onClose={onClose}
				fullWidth
				maxWidth="sm"
				aria-labelledby="new-request-dialog-title"
			>
				<DialogTitle id="new-request-dialog-title">
					{translate('profile.data.register.dialog.title')}
					<IconButton
						aria-label={translate(
							'profile.data.register.dialog.close'
						)}
						onClick={onClose}
						sx={{ position: 'absolute', right: 8, top: 8 }}
					>
						<CloseRoundedIcon />
					</IconButton>
				</DialogTitle>
				<DialogContent>
					<OrisoSelect
						id="topicSelect"
						label={translate(
							'profile.data.register.consultingTypeSelect.label'
						)}
						options={topicOptions}
						value={currentSelectOption}
						onChange={handleConsultingTypeSelect}
					/>
					{selectedTopicId !== null && (
						<AdditionalAgencySelection
							selectedTopicId={selectedTopicId}
							initialPostcode={prefilledPostcode}
							knownAgencyIds={knownAgencyIds}
							onAgencyChange={(agency) =>
								setSelectedAgency(agency)
							}
							onPostcodeChange={(postcode) =>
								setSelectedPostcode(postcode)
							}
						/>
					)}
					{overlayActive && dpaFailure && (
						<Dialog
							open
							onClose={() =>
								handleOverlayAction(OVERLAY_FUNCTIONS.CLOSE)
							}
							aria-labelledby="new-request-dpa-heading"
							aria-describedby="new-request-dpa-text"
						>
							<DialogTitle id="new-request-dpa-heading">
								{overlayItem.headline}
							</DialogTitle>
							<DialogContent>
								<DialogContentText id="new-request-dpa-text">
									{overlayItem.copy}
								</DialogContentText>
							</DialogContent>
							<DialogActions>
								<Button
									item={overlayItem.buttonSet[0]}
									buttonHandle={() =>
										handleOverlayAction(
											OVERLAY_FUNCTIONS.CLOSE
										)
									}
								/>
							</DialogActions>
						</Dialog>
					)}
				</DialogContent>
				<Box
					className="newRequestDialog__footer"
					data-cy="new-request-footer"
					sx={{
						px: 3,
						pb: 2,
						pt: 1,
						display: 'flex',
						flexDirection: 'column',
						gap: 1.5,
						borderTop: consentStep ? 1 : 0,
						borderColor: 'divider'
					}}
				>
					<Typography
						variant="body2"
						color="text.secondary"
						data-cy="new-request-same-topic-info"
					>
						{translate('furtherCounselling.request.sameTopicInfo')}
					</Typography>
					{consentStep && (
						<>
							<ConsentCompletionPanel
								visible
								ariaLabel={translate(
									'furtherCounselling.request.consentAria'
								)}
								checked={consent.accepted}
								disabled={!consent.isResolved}
								onChange={consent.toggle}
								inputRef={consentInputRef}
								label={
									<DataProtectionConsentLabel
										agency={consentAgency ?? undefined}
										topic={selectedTopic ?? undefined}
										onResolutionChange={
											consent.onResolutionChange
										}
									/>
								}
							/>
							{consent.failure && (
								<Alert severity="error">
									{translate(
										consent.failure === 'unrenderable'
											? 'registration.dataProtection.unrenderable'
											: 'registration.agency.legal.unavailable'
									)}
								</Alert>
							)}
						</>
					)}
					<Box
						sx={{
							display: 'flex',
							flexWrap: 'wrap',
							gap: 1,
							justifyContent: 'flex-end'
						}}
					>
						{consentStep && (
							<Button
								item={buttonCancel}
								buttonHandle={onClose}
							/>
						)}
						<Button
							item={buttonSetRegistration}
							buttonHandle={handleRegistration}
							disabled={
								isButtonDisabled ||
								isRequestInProgress ||
								(consentStep && !consent.accepted)
							}
						/>
					</Box>
				</Box>
			</Dialog>
			{open && showOverlay && (
				<Overlay
					item={overlayItem}
					handleOverlay={handleOverlayAction}
				/>
			)}
		</>
	);
};
