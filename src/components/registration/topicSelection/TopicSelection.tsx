import * as React from 'react';
import {
	Typography,
	Accordion,
	AccordionDetails,
	AccordionSummary,
	Avatar,
	Box,
	Divider,
	List,
	ListItemButton,
	ListItemText,
	Radio,
	FormControl
} from '@mui/material';
import {
	FC,
	useContext,
	useState,
	useEffect,
	SetStateAction,
	Dispatch,
	useCallback,
	useRef,
	useMemo
} from 'react';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useTranslation } from 'react-i18next';
import { LocaleContext } from '../../../globalState/context/LocaleContext';
import {
	RegistrationContext,
	RegistrationData
} from '../../../globalState/provider/RegistrationProvider';
import { apiGetTopicsData } from '../../../api/apiGetTopicsData';
import { TopicsDataInterface } from '../../../globalState/interfaces/TopicsDataInterface';
import { Loading } from '../../../components/app/Loading';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { UrlParamsContext } from '../../../globalState/provider/UrlParamsProvider';
import {
	buildRegistrationTopicPresentationGroups,
	getRegistrationTopicDisplay,
	getRegistrationTopicIcon,
	registrationMd3,
	registrationScreenIntroSx,
	registrationScreenTitleSx,
	RegistrationTopicPresentationGroup
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
	const [value, setValue] = useState<number | undefined>(
		registrationData?.mainTopicId || undefined
	);
	const [topicGroups, setTopicGroups] =
		useState<RegistrationTopicPresentationGroup[]>();
	const [topics, setTopics] = useState<TopicsDataInterface[]>();
	const [listView, setListView] = useState<boolean>(false);
	const [topicGroupId, setTopicGroupId] = useState<number | undefined>(
		registrationData?.topicGroupId || undefined
	);
	const [selectedPlacementId, setSelectedPlacementId] = useState<
		string | undefined
	>();
	const [expandedTopicGroupIds, setExpandedTopicGroupIds] = useState<
		number[]
	>([]);
	const topicGroupRefs = useRef<Record<number, HTMLDivElement | null>>({});
	const firstGroupedPlacementId = useMemo(
		() =>
			topicGroups?.flatMap((topicGroup) => topicGroup.topics)[0]
				?.placementId,
		[topicGroups]
	);
	const activeGroupedPlacementId = useMemo(() => {
		if (selectedPlacementId) {
			return selectedPlacementId;
		}

		if (value == null) {
			return firstGroupedPlacementId;
		}

		return (
			topicGroups
				?.flatMap((topicGroup) => topicGroup.topics)
				.find(
					(placement) =>
						placement.topic.id === value &&
						(!topicGroupId ||
							placement.topicGroupId === topicGroupId)
				)?.placementId || firstGroupedPlacementId
		);
	}, [
		firstGroupedPlacementId,
		selectedPlacementId,
		topicGroupId,
		topicGroups,
		value
	]);

	const compareTopicsByDisplayName = useCallback(
		(a: TopicsDataInterface, b: TopicsDataInterface) =>
			getRegistrationTopicDisplay(a, locale).title.localeCompare(
				getRegistrationTopicDisplay(b, locale).title,
				locale
			),
		[locale]
	);

	const scrollTopicGroupIntoView = useCallback((groupId: number) => {
		window.setTimeout(() => {
			const node = topicGroupRefs.current[groupId];
			if (!node || typeof window === 'undefined') {
				return;
			}

			const prefersReducedMotion =
				typeof window.matchMedia === 'function' &&
				window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			if (prefersReducedMotion) {
				return;
			}

			const rect = node.getBoundingClientRect();
			const shouldScroll =
				rect.top < 96 || rect.top > window.innerHeight * 0.42;
			if (!shouldScroll) {
				return;
			}

			window.scrollTo({
				top: Math.max(0, window.scrollY + rect.top - 88),
				behavior: 'smooth'
			});
		}, 60);
	}, []);

	const toggleTopicGroup = useCallback(
		(groupId: number) => {
			setExpandedTopicGroupIds((currentIds) => {
				const isExpanded = currentIds.includes(groupId);
				if (!isExpanded) {
					scrollTopicGroupIntoView(groupId);
				}

				return isExpanded
					? currentIds.filter((id) => id !== groupId)
					: [...currentIds, groupId];
			});
		},
		[scrollTopicGroupIntoView]
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
				(value != null
					? topicGroups.find((topicGroup) =>
							topicGroup.topicIds.includes(value)
						)?.id
					: undefined);

			if (!topicGroupId && selectedGroupId) {
				setTopicGroupId(selectedGroupId);
			}

			return [selectedGroupId || topicGroups[0].id];
		});

		if (!selectedPlacementId && value != null) {
			const selectedPlacement = topicGroups
				.flatMap((topicGroup) => topicGroup.topics)
				.find(
					(placement) =>
						placement.topic.id === value &&
						(!topicGroupId ||
							placement.topicGroupId === topicGroupId)
				);

			if (selectedPlacement) {
				setSelectedPlacementId(selectedPlacement.placementId);
			}
		}
	}, [topicGroups, topicGroupId, value, selectedPlacementId]);

	useEffect(() => {
		const hasGroupedTopic =
			value != null &&
			topicGroups?.some((topicGroup) =>
				topicGroup.topicIds.includes(value)
			);
		const hasListedTopic =
			value != null &&
			listView &&
			topics?.some((topic) => topic.id === value);

		if (hasGroupedTopic || hasListedTopic) {
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
		const filterConsultantTopics = (t: TopicsDataInterface) =>
			!preselectedConsultant ||
			preselectedConsultant.agencies.some((a) =>
				a.topicIds?.includes(t.id)
			);

		const filterAgencyTopics = (t: TopicsDataInterface) =>
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
				const filteredTopics = getFilteredTopics(topicsResponse);
				const presentationGroups =
					buildRegistrationTopicPresentationGroups(
						filteredTopics,
						locale
					);
				const nextListView =
					!!(preselectedAgency || preselectedConsultant) ||
					presentationGroups.length === 0;

				if (cancelled) return;

				setTopicGroups(presentationGroups);
				setListView(nextListView);
				setTopics(filteredTopics);
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
	}, [locale, preselectedConsultant, preselectedAgency, preselectedTopic]);

	return (
		<>
			{topics?.length === 1 ? (
				<Typography
					component="h1"
					variant="h3"
					sx={{ mb: '24px', ...registrationScreenTitleSx }}
				>
					{t('registration.topic.oneResult')}
				</Typography>
			) : (
				<>
					<Typography
						component="h1"
						variant="h3"
						sx={registrationScreenTitleSx}
					>
						{t('registration.topic.headline')}
					</Typography>
					<Typography
						sx={{
							mt: '16px',
							mb: '24px',
							...registrationScreenIntroSx
						}}
					>
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
					<Box
						role="radiogroup"
						aria-label="topic-selection"
						data-cy="topic-radio-group"
						sx={{ display: 'grid', gap: 1.5 }}
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
											topicIcon={getRegistrationTopicIcon(
												topic
											)}
											locale={locale}
											checked={value === topic?.id}
											tabIndex={
												value === topic.id ||
												(value == null && index === 0)
													? 0
													: -1
											}
											singleTopic={topics.length === 1}
											onChange={() => {
												setValue(topic.id);
												setTopicGroupId(undefined);
												setSelectedPlacementId(
													`list/${topic.id}`
												);
												onChange({
													mainTopic: topic,
													topicGroupId: undefined
												});
											}}
										/>
									))
							: (topicGroups || []).map((topicGroup) => {
									const expanded =
										expandedTopicGroupIds.includes(
											topicGroup.id
										);
									const holdsSelection =
										topicGroup.id === topicGroupId &&
										value != null;

									return (
										<Accordion
											data-cy={`topic-group-${topicGroup.id}`}
											key={`topicGroup-${topicGroup.id}`}
											ref={(node) => {
												topicGroupRefs.current[
													topicGroup.id
												] = node;
											}}
											expanded={expanded}
											onChange={() =>
												toggleTopicGroup(topicGroup.id)
											}
											disableGutters
											elevation={0}
											TransitionProps={{
												unmountOnExit: true,
												timeout: {
													enter: 220,
													exit: 170
												},
												style: {
													transitionDelay: expanded
														? '0ms'
														: '50ms'
												}
											}}
											sx={{
												'boxShadow': 'none',
												'border': `1px solid ${registrationMd3.outlineVariant}`,
												'borderRadius': 4,
												'overflow': 'hidden',
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
													<ExpandMoreRoundedIcon
														sx={{
															color: registrationMd3.onSurfaceVariant,
															width: 32,
															height: 32
														}}
													/>
												}
												aria-controls={`panel-${topicGroup.categoryId}-content`}
												id={`panel-${topicGroup.categoryId}`}
												sx={{
													'minHeight': 68,
													'px': 2,
													'background': `linear-gradient(100deg, ${registrationMd3.surfaceContainerHigh} 0%, ${registrationMd3.surfaceContainerLow} 90%)`,
													'& .MuiAccordionSummary-content':
														{
															alignItems:
																'center',
															gap: 1.5,
															my: 1.25,
															minWidth: 0
														},
													'& .MuiAccordionSummary-content.Mui-expanded':
														{
															m: '10px 0'
														}
												}}
											>
												<Avatar
													src={topicGroup.icon}
													alt=""
													imgProps={{
														loading: 'lazy',
														decoding: 'async'
													}}
													sx={{
														width: 52,
														height: 52,
														bgcolor: 'transparent',
														border: `2px solid ${registrationMd3.onSurface}`,
														flexShrink: 0
													}}
												/>
												<Typography
													variant="h6"
													sx={{
														flex: 1,
														minWidth: 0,
														fontWeight: 700,
														color: registrationMd3.onSurface
													}}
												>
													{topicGroup.name}
												</Typography>
												{holdsSelection &&
													!expanded && (
														<CheckCircleRoundedIcon
															sx={{
																color: registrationMd3.primary,
																fontSize: 20,
																mr: 0.5
															}}
															aria-hidden
														/>
													)}
											</AccordionSummary>
											<AccordionDetails
												sx={{ p: 0 }}
												data-cy={`topic-group-${topicGroup.id}-topic-selection-radio-group`}
											>
												<List disablePadding>
													{topicGroup.topics.map(
														(
															placement,
															index,
															placements
														) => (
															<TopicSelect
																key={
																	placement.placementId
																}
																topics={topics}
																index={index}
																isLast={
																	index ===
																	placements.length -
																		1
																}
																topic={
																	placement.topic
																}
																topicIcon={
																	placement.icon
																}
																locale={locale}
																checked={
																	selectedPlacementId ===
																	placement.placementId
																}
																tabIndex={
																	activeGroupedPlacementId ===
																	placement.placementId
																		? 0
																		: -1
																}
																onChange={() => {
																	setValue(
																		placement
																			.topic
																			.id
																	);
																	setTopicGroupId(
																		topicGroup.id
																	);
																	setSelectedPlacementId(
																		placement.placementId
																	);
																	onChange({
																		mainTopic:
																			placement.topic,
																		topicGroupId:
																			topicGroup.id
																	});
																}}
															/>
														)
													)}
												</List>
											</AccordionDetails>
										</Accordion>
									);
								})}
					</Box>
				</FormControl>
			)}
		</>
	);
};

const TopicSelect = ({
	topics,
	topic,
	topicIcon,
	locale,
	index,
	isLast,
	onChange,
	checked,
	tabIndex,
	singleTopic = false
}: {
	topics: TopicsDataInterface[];
	topic: TopicsDataInterface;
	topicIcon: string;
	locale?: string;
	index: number;
	isLast: boolean;
	onChange: () => void;
	checked: boolean;
	tabIndex: number;
	singleTopic?: boolean;
}) => {
	const display = getRegistrationTopicDisplay(topic, locale);
	const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onChange();
			return;
		}

		if (
			event.key !== 'ArrowDown' &&
			event.key !== 'ArrowRight' &&
			event.key !== 'ArrowUp' &&
			event.key !== 'ArrowLeft'
		) {
			return;
		}

		const group = event.currentTarget.closest('[role="radiogroup"]');
		const radios = Array.from(
			group?.querySelectorAll<HTMLElement>(
				'[role="radio"]:not([aria-disabled="true"])'
			) || []
		);
		const currentIndex = radios.indexOf(event.currentTarget);

		if (currentIndex < 0 || radios.length === 0) {
			return;
		}

		event.preventDefault();
		const direction =
			event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
		const nextIndex =
			(currentIndex + direction + radios.length) % radios.length;
		radios[nextIndex].focus();
		radios[nextIndex].click();
	};

	return (
		<Box sx={{ listStyle: 'none' }}>
			{index > 0 && <Divider component="div" sx={{ mx: 2 }} />}
			<ListItemButton
				data-cy={`topic-selection-radio-${topic.id}`}
				role="radio"
				aria-checked={checked}
				aria-disabled={singleTopic || undefined}
				tabIndex={singleTopic ? -1 : tabIndex}
				selected={checked}
				disabled={singleTopic}
				onClick={onChange}
				onKeyDown={handleKeyDown}
				sx={{
					'px': 2,
					'py': 1.5,
					'alignItems': 'flex-start',
					'gap': 1.75,
					'backgroundColor': checked
						? registrationMd3.selectedLayer
						: registrationMd3.surface,
					'&:hover': {
						backgroundColor: checked
							? registrationMd3.selectedLayer
							: registrationMd3.hoverLayer
					},
					'&.Mui-selected': {
						backgroundColor: registrationMd3.selectedLayer
					},
					'&.Mui-selected:hover': {
						backgroundColor: registrationMd3.selectedLayer
					}
				}}
			>
				<Avatar
					src={topicIcon}
					alt=""
					variant="rounded"
					imgProps={{
						loading: 'lazy',
						decoding: 'async'
					}}
					sx={{
						width: 64,
						height: 64,
						borderRadius: isLast ? '12px 12px 12px 32px' : '12px',
						bgcolor: 'transparent',
						flexShrink: 0
					}}
				/>
				<ListItemText
					primary={display.title}
					secondary={display.description}
					primaryTypographyProps={{
						variant: 'subtitle1',
						color: registrationMd3.onSurface,
						fontWeight: 700,
						lineHeight: 1.35,
						sx: {
							overflowWrap: 'normal',
							wordBreak: 'normal',
							hyphens: 'auto'
						}
					}}
					secondaryTypographyProps={{
						variant: 'body2',
						color: registrationMd3.onSurfaceVariant,
						sx: {
							lineHeight: 1.45
						}
					}}
					sx={{ my: 0, minWidth: 0 }}
				/>
				<Radio
					checked={checked}
					tabIndex={-1}
					disableRipple
					edge="end"
					onClick={(event) => event.stopPropagation()}
					onChange={onChange}
					inputProps={{ 'aria-hidden': true }}
					sx={{
						mt: 0.5,
						alignSelf: 'flex-start',
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
			</ListItemButton>
		</Box>
	);
};
