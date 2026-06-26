import * as React from 'react';
import {
	Typography,
	Accordion,
	AccordionDetails,
	AccordionSummary,
	Avatar,
	Box,
	FormControlLabel,
	Radio,
	RadioGroup,
	FormControl
} from '@mui/material';
import {
	FC,
	useContext,
	useState,
	useEffect,
	SetStateAction,
	Dispatch,
	useCallback
} from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import { LocaleContext } from '../../../globalState/context/LocaleContext';
import {
	RegistrationContext,
	RegistrationData
} from '../../../globalState/provider/RegistrationProvider';
import { apiGetTopicGroups } from '../../../api/apiGetTopicGroups';
import { apiGetTopicsData } from '../../../api/apiGetTopicsData';
import { TopicGroup } from '../../../globalState/interfaces/TopicGroups';
import { TopicsDataInterface } from '../../../globalState/interfaces/TopicsDataInterface';
import { Loading } from '../../../components/app/Loading';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { UrlParamsContext } from '../../../globalState/provider/UrlParamsProvider';
import {
	getRegistrationCategoryIcon,
	getRegistrationTopicDisplay,
	getRegistrationTopicIcon,
	registrationMd3
} from '../registrationDesign/registrationDesign';

export const TopicSelection: FC<{
	onChange: Dispatch<SetStateAction<Partial<RegistrationData>>>;
	nextStepUrl: string;
	onNextClick(): void;
}> = ({ onChange }) => {
	const { setDisabledNextButton, registrationData } =
		useContext(RegistrationContext);
	const {
		topic: preselectedTopic,
		agency: preselectedAgency,
		consultant: preselectedConsultant
	} = useContext(UrlParamsContext);
	const { t } = useTranslation();
	const { locale } = useContext(LocaleContext);
	const [value, setValue] = useState<number>(
		registrationData.mainTopicId || undefined
	);
	const [topicGroups, setTopicGroups] = useState<TopicGroup[]>();
	const [topics, setTopics] = useState<TopicsDataInterface[]>();
	const [listView, setListView] = useState<boolean>(false);
	const [topicGroupId, setTopicGroupId] = useState<number>(
		registrationData.topicGroupId || undefined
	);
	const [expandedTopicGroupIds, setExpandedTopicGroupIds] = useState<
		number[]
	>([]);
	const compareByLocalizedName = useCallback(
		(a: { name: string }, b: { name: string }) =>
			a.name.localeCompare(b.name, locale),
		[locale]
	);
	const compareTopicsByDisplayName = useCallback(
		(a: TopicsDataInterface, b: TopicsDataInterface) =>
			getRegistrationTopicDisplay(a, locale).title.localeCompare(
				getRegistrationTopicDisplay(b, locale).title,
				locale
			),
		[locale]
	);

	const getTopic = useCallback(
		(mainTopicId: number) =>
			topics?.find((topic) => topic?.id === mainTopicId),
		[topics]
	);

	useEffect(() => {
		if (!topicGroups?.length) {
			return;
		}

		setExpandedTopicGroupIds((currentIds) => {
			const existingIds = currentIds.filter((id) =>
				topicGroups.some((topicGroup) => topicGroup.id === id)
			);
			if (existingIds.length > 0) {
				return existingIds;
			}

			const selectedGroupId =
				topicGroupId ||
				topicGroups.find((topicGroup) =>
					topicGroup.topicIds.includes(value)
				)?.id;

			return [selectedGroupId || topicGroups[0].id];
		});
	}, [topicGroups, topicGroupId, value]);

	useEffect(() => {
		if (
			value != null &&
			(topicGroups?.some((topicGroup) =>
				topicGroup.topicIds.includes(value)
			) ||
				(listView && topics?.some((topic) => topic.id === value)))
		) {
			setDisabledNextButton(false);
		}
	}, [setDisabledNextButton, value, topicGroups, listView, topics]);

	useEffect(() => {
		setListView(!!(preselectedAgency || preselectedConsultant));
	}, [preselectedConsultant, preselectedAgency]);

	useEffect(() => {
		if (topics?.length === 1) {
			setValue(topics[0].id);
			onChange({
				mainTopic: topics[0]
			});
		}
	}, [topics, onChange]);

	useEffect(() => {
		const filterConsultantTopics = (t) =>
			!preselectedConsultant ||
			preselectedConsultant.agencies.some((a) =>
				a.topicIds?.includes(t.id)
			);

		const filterAgencyTopics = (t) =>
			!preselectedAgency || preselectedAgency.topicIds?.includes(t.id);

		const getFilteredTopics = (topics: TopicsDataInterface[]) =>
			topics
				// Filter topic by preselected topic
				.filter(
					(t) => !preselectedTopic || t.id === preselectedTopic?.id
				)
				// Filter topics by consultant topics
				.filter(filterConsultantTopics)
				// Filter topics by preselected agency
				.filter(filterAgencyTopics);
		let cancelled = false;

		(async () => {
			setTopics(undefined);
			setTopicGroups(undefined);

			try {
				const topicsResponse = await apiGetTopicsData();
				const topics = getFilteredTopics(topicsResponse);
				const topicIds = topics.map((t) => t.id);
				let filteredTopicGroups: TopicGroup[] = [];
				let nextListView = !!(
					preselectedAgency || preselectedConsultant
				);

				try {
					const topicGroupsResponse = await apiGetTopicGroups();
					filteredTopicGroups = topicGroupsResponse.data.items
						.filter((topicGroup) => topicGroup.topicIds.length > 0)
						.filter((topicGroup) =>
							topicGroup.topicIds.some((id) =>
								topicIds.includes(id)
							)
						)
						.sort(compareByLocalizedName);
					nextListView =
						nextListView ||
						(filteredTopicGroups.length === 0 && topics.length > 0);
				} catch (e) {
					nextListView = true;
				}

				if (cancelled) return;

				setTopicGroups(filteredTopicGroups);
				setListView(nextListView);
				setTopics(topics);
			} catch (e) {
				if (cancelled) return;

				setTopicGroups([]);
				setListView(true);
				setTopics([]);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [
		compareByLocalizedName,
		preselectedConsultant,
		preselectedAgency,
		preselectedTopic
	]);

	return (
		<>
			{topics?.length === 1 ? (
				<Typography variant="h3" sx={{ mb: '24px' }}>
					{t('registration.topic.oneResult')}
				</Typography>
			) : (
				<>
					<Typography variant="h3">
						{t('registration.topic.headline')}
					</Typography>
					<Typography sx={{ mt: '16px', mb: '24px' }}>
						{t('registration.topic.subline')}
					</Typography>
				</>
			)}
			{topics === undefined || topicGroups === undefined ? (
				<Box
					sx={{
						mt: '80px',
						width: '100%',
						display: 'flex',
						justifyContent: 'center'
					}}
				>
					<Loading />
				</Box>
			) : (
				<FormControl sx={{ width: '100%' }}>
					<RadioGroup
						aria-label="topic-selection"
						name="topic-selection"
						data-cy={`topic-radio-group`}
						defaultValue={topics.length === 1 ? topics[0].id : ''}
					>
						{listView
							? [...(topics || [])]
									.sort(compareTopicsByDisplayName)
									.map((topic, index, sortedTopics) => (
										<TopicSelect
											key={`${topic.id}`}
											topics={topics}
											index={index}
											isLast={
												index ===
												sortedTopics.length - 1
											}
											topic={topic}
											locale={locale}
											checked={value === topic?.id}
											onChange={() => {
												setValue(topic.id);
												onChange({
													mainTopic: topic
												});
											}}
										/>
									))
							: (topicGroups || []).map(
									(topicGroup, groupIndex) => (
										<Accordion
											data-cy={`topic-group-${topicGroup.id}`}
											key={`topicGroup-${topicGroup.id}`}
											expanded={expandedTopicGroupIds.includes(
												topicGroup.id
											)}
											onChange={() => {
												setExpandedTopicGroupIds(
													(currentIds) =>
														currentIds.includes(
															topicGroup.id
														)
															? currentIds.filter(
																	(id) =>
																		id !==
																		topicGroup.id
																)
															: [
																	...currentIds,
																	topicGroup.id
																]
												);
											}}
											disableGutters
											elevation={0}
											TransitionProps={{
												unmountOnExit: true
											}}
											sx={{
												'boxShadow': 'none',
												'border': `1px solid ${registrationMd3.outlineVariant}`,
												'borderRadius': '32px',
												'overflow': 'hidden',
												'mb': '12px',
												'backgroundColor':
													registrationMd3.surface,
												'&:before': {
													display: 'none'
												},
												'& .MuiAccordionSummary-root:hover':
													{
														backgroundColor:
															registrationMd3.hoverLayer
													},
												'&.Mui-expanded': {
													margin: 0
												}
											}}
										>
											<AccordionSummary
												expandIcon={
													<ExpandMoreIcon
														sx={{
															color: registrationMd3.onSurfaceVariant,
															width: '32px',
															height: '32px'
														}}
													/>
												}
												aria-controls={`panel-${topicGroup.name}-content`}
												id={`panel-${topicGroup.name}`}
												sx={{
													'minHeight': '72px',
													'px': 2,
													'background': `linear-gradient(100deg, ${registrationMd3.surfaceContainerHigh} 0%, ${registrationMd3.surfaceContainerLow} 90%)`,
													'& .MuiAccordionSummary-content':
														{
															alignItems:
																'center',
															gap: 1.5,
															my: 1.25
														},
													'& .MuiAccordionSummary-content.Mui-expanded':
														{
															m: '12px 0'
														}
												}}
											>
												<Avatar
													src={getRegistrationCategoryIcon(
														groupIndex
													)}
													alt=""
													imgProps={{
														loading: 'lazy',
														decoding: 'async'
													}}
													sx={{
														width: 54,
														height: 54,
														bgcolor: 'transparent',
														border: `2px solid ${registrationMd3.onSurface}`
													}}
												/>
												<Typography
													variant="h4"
													sx={{
														lineHeight: '30px',
														fontWeight: '700',
														color: registrationMd3.onSurface
													}}
												>
													{topicGroup.name}
												</Typography>
											</AccordionSummary>
											<AccordionDetails
												sx={{ p: 0 }}
												data-cy={`topic-group-${topicGroup.id}-topic-selection-radio-group`}
											>
												{topicGroup.topicIds
													.map((t) => getTopic(t))
													.filter(Boolean)
													.sort(
														compareTopicsByDisplayName
													)
													.map(
														(
															topic,
															index,
															sortedTopics
														) => (
															<TopicSelect
																key={`${topicGroup.id}-${topic.id}`}
																topics={topics}
																index={index}
																isLast={
																	index ===
																	sortedTopics.length -
																		1
																}
																topic={topic}
																locale={locale}
																checked={
																	value ===
																		topic.id &&
																	topicGroup.id ===
																		topicGroupId
																}
																onChange={() => {
																	setValue(
																		topic.id
																	);
																	setTopicGroupId(
																		topicGroup.id
																	);
																	onChange({
																		mainTopic:
																			topic,
																		topicGroupId:
																			topicGroup?.id
																	});
																}}
															/>
														)
													)}
											</AccordionDetails>
										</Accordion>
									)
								)}
					</RadioGroup>
				</FormControl>
			)}
		</>
	);
};

const TopicSelect = ({
	topics,
	topic,
	locale,
	index,
	isLast,
	onChange,
	checked
}) => {
	const display = getRegistrationTopicDisplay(topic, locale);

	return (
		<Box
			key={topic.id}
			sx={{
				borderTop:
					index === 0
						? 'none'
						: `1px solid ${registrationMd3.outlineVariant}`
			}}
		>
			<FormControlLabel
				data-cy={`topic-selection-radio-${topic.id}`}
				disabled={topics.length === 1}
				labelPlacement="start"
				sx={{
					'alignItems': 'stretch',
					'display': 'flex',
					'm': 0,
					'width': '100%',
					'justifyContent': 'space-between',
					'backgroundColor': checked
						? registrationMd3.selectedLayer
						: registrationMd3.surface,
					'&:hover': {
						backgroundColor: checked
							? registrationMd3.selectedLayer
							: registrationMd3.hoverLayer
					},
					'& .MuiFormControlLabel-label': {
						width: '100%'
					}
				}}
				value={topic?.id}
				control={
					<Radio
						tabIndex={0}
						onClick={onChange}
						checked={checked}
						sx={{
							alignSelf: 'flex-start',
							mt: '22px',
							mx: 1.5,
							color: registrationMd3.outline
						}}
						checkedIcon={
							topics.length === 1 ? (
								<TaskAltIcon color="info" />
							) : undefined
						}
						icon={
							topics.length === 1 ? (
								<TaskAltIcon color="info" />
							) : undefined
						}
					/>
				}
				label={
					<Box
						sx={{
							display: 'flex',
							alignItems: 'flex-start',
							gap: 1.75,
							py: 1.5,
							pr: 2,
							minWidth: 0
						}}
					>
						<Avatar
							src={getRegistrationTopicIcon(topic)}
							alt=""
							variant="rounded"
							imgProps={{
								loading: 'lazy',
								decoding: 'async'
							}}
							sx={{
								width: 64,
								height: 64,
								borderRadius: isLast
									? '12px 12px 12px 32px'
									: '12px',
								bgcolor: 'transparent',
								flexShrink: 0
							}}
						/>
						<Box sx={{ minWidth: 0, pt: '2px' }}>
							<Typography
								variant="subtitle1"
								sx={{
									fontWeight: 700,
									color: registrationMd3.onSurface,
									lineHeight: 1.35,
									overflowWrap: 'normal',
									wordBreak: 'normal',
									hyphens: 'auto'
								}}
							>
								{display.title}
							</Typography>
							{display.description && (
								<Typography
									variant="body2"
									sx={{
										mt: 0.25,
										color: registrationMd3.onSurfaceVariant,
										lineHeight: 1.45
									}}
								>
									{display.description}
								</Typography>
							)}
						</Box>
					</Box>
				}
			/>
		</Box>
	);
};
