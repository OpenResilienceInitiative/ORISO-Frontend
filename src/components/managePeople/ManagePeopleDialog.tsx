import * as React from 'react';
import { ReactNode, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircularProgress } from '@mui/material';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { OrisoTextField } from '../form/OrisoTextField';
import { OrisoTextarea } from '../form/OrisoTextarea';
import { UserAvatar } from '../message/UserAvatar';
import {
	ManagedPeopleSource,
	ManagedPerson,
	matchesPersonSearch,
	PersonCandidate
} from './managedPeople';
import { useManagedPeople } from './useManagedPeople';
import './managePeople.styles.scss';

const AVATAR_SIZE = 40;
const SEARCH_FROM_COUNT = 6;

export interface ManagePeopleDialogProps {
	open: boolean;
	onClose: () => void;
	source: ManagedPeopleSource;
	/** Invite link and QR code for people who join by themselves. */
	inviteContent?: ReactNode;
	/** Phone presentation; the caller decides the breakpoint, like `M3Dialog`. */
	fullScreen?: boolean;
}

/**
 * The one dialog to see, add, replace, remove and invite the people of a
 * conversation. The source decides what is possible; this component only
 * decides how it looks and never calls an endpoint itself.
 */
export const ManagePeopleDialog = ({
	open,
	onClose,
	source,
	inviteContent,
	fullScreen = false
}: ManagePeopleDialogProps) => {
	const { t: translate, i18n } = useTranslation();
	const copy = (key: string, options?: Record<string, unknown>) =>
		translate(`managePeople.${source.kind}.${key}`, options ?? {});
	const shared = (key: string, options?: Record<string, unknown>) =>
		translate(`managePeople.${key}`, options ?? {});
	const people = useManagedPeople(source, open, i18n.language.split('@')[0]);

	const [query, setQuery] = useState('');
	const [chosen, setChosen] = useState<PersonCandidate | null>(null);
	const [reason, setReason] = useState('');
	const [reasonMissing, setReasonMissing] = useState(false);
	const [replacing, setReplacing] = useState<ManagedPerson | null>(null);
	const [confirmingRemove, setConfirmingRemove] = useState<string | null>(
		null
	);
	const pickerHeadingId = useId();

	const resetPicker = () => {
		setChosen(null);
		setReason('');
		setReasonMissing(false);
		setReplacing(null);
		setQuery('');
	};

	useEffect(() => {
		if (open) return;
		resetPicker();
		setConfirmingRemove(null);
	}, [open]);

	const canAdd = Boolean(source.addPerson && source.loadCandidates);
	const showPicker = canAdd || replacing !== null;
	const visibleCandidates = people.candidates.filter((candidate) =>
		matchesPersonSearch(candidate, query)
	);

	const submit = async (candidate: PersonCandidate) => {
		const trimmed = reason.trim();
		if (source.requiresReason && !trimmed) {
			setReasonMissing(true);
			return;
		}
		const input = source.requiresReason ? { reason: trimmed } : {};
		const done = replacing
			? await people.replacePerson(replacing, candidate, input)
			: await people.addPerson(candidate, input);
		if (done) {
			resetPicker();
		}
	};

	const pick = (candidate: PersonCandidate) => {
		people.clearActionError();
		if (source.requiresReason) {
			setChosen(candidate);
			return;
		}
		void submit(candidate);
	};

	const renderMember = (person: ManagedPerson) => {
		const isPending = people.pendingId === person.id;
		const isConfirming = confirmingRemove === person.id;
		const cannotReplace =
			person.canReplace &&
			people.candidatesState === 'ready' &&
			people.candidates.length === 0;
		const since =
			person.since &&
			new Date(person.since).toLocaleDateString(
				i18n.language.split('@')[0]
			);

		return (
			<li key={person.id} className="managePeople__person">
				<UserAvatar
					username={person.name}
					displayName={person.name}
					userId={person.id}
					size={AVATAR_SIZE}
					ring={false}
				/>
				<div className="managePeople__personText">
					<div className="managePeople__personName">
						<span>
							{person.name}
							{person.isSelf && ` ${shared('self')}`}
						</span>
						{person.isStanding && (
							<span className="managePeople__badge">
								{shared('standing.badge')}
							</span>
						)}
						{person.role !== 'supervisor' &&
							person.role !== 'participant' && (
								<span className="managePeople__badge">
									{shared(`role.${person.role}`)}
								</span>
							)}
					</div>
					{person.organisation && (
						<div className="managePeople__personMeta">
							{person.organisation}
						</div>
					)}
					{since && (
						<div className="managePeople__personMeta">
							{shared('since', { date: since })}
						</div>
					)}
					{person.reason && (
						<div className="managePeople__personMeta">
							{person.reason}
						</div>
					)}
					{person.isStanding && (
						<div className="managePeople__personMeta">
							{shared(
								cannotReplace
									? 'standing.noReplacement'
									: 'standing.hint'
							)}
						</div>
					)}
				</div>
				<div className="managePeople__personActions">
					{isPending && (
						<CircularProgress
							size={20}
							aria-label={shared('working')}
						/>
					)}
					{!isPending && isConfirming && (
						<>
							<span className="managePeople__confirmText">
								{shared('remove.confirm')}
							</span>
							<button
								type="button"
								className="managePeople__action"
								onClick={() => setConfirmingRemove(null)}
							>
								{shared('cancel')}
							</button>
							<button
								type="button"
								className="managePeople__action managePeople__action--danger"
								aria-label={shared('remove.labelFor', {
									name: person.name
								})}
								onClick={() => {
									setConfirmingRemove(null);
									void people.removePerson(person);
								}}
							>
								{shared('remove.action')}
							</button>
						</>
					)}
					{!isPending && !isConfirming && person.canReplace && (
						<button
							type="button"
							className="managePeople__action"
							disabled={cannotReplace}
							aria-label={shared('replace.labelFor', {
								name: person.name
							})}
							onClick={() => {
								resetPicker();
								people.clearActionError();
								setReplacing(person);
							}}
						>
							{shared('replace.action')}
						</button>
					)}
					{!isPending && !isConfirming && person.canRemove && (
						<button
							type="button"
							className="managePeople__action managePeople__action--danger"
							aria-label={shared('remove.labelFor', {
								name: person.name
							})}
							onClick={() => {
								people.clearActionError();
								setConfirmingRemove(person.id);
							}}
						>
							{shared('remove.action')}
						</button>
					)}
				</div>
			</li>
		);
	};

	const renderMembers = () => {
		if (people.membersState === 'loading') {
			return (
				<p role="status" className="managePeople__state">
					{shared('loading')}
				</p>
			);
		}
		if (people.membersState === 'error') {
			return (
				<div role="alert" className="managePeople__state">
					{shared('error.members')}{' '}
					<button
						type="button"
						className="managePeople__action"
						onClick={() => void people.reload()}
					>
						{shared('retry')}
					</button>
				</div>
			);
		}
		if (people.members.length === 0) {
			return (
				<p className="managePeople__state">{copy('emptyMembers')}</p>
			);
		}
		return (
			<ul className="managePeople__list">
				{people.members.map(renderMember)}
			</ul>
		);
	};

	const renderChosen = (candidate: PersonCandidate) => (
		<div className="managePeople__chosen">
			<div className="managePeople__person">
				<UserAvatar
					username={candidate.name}
					displayName={candidate.name}
					userId={candidate.id}
					size={AVATAR_SIZE}
					ring={false}
				/>
				<div className="managePeople__personText">
					<div className="managePeople__personName">
						<span>{candidate.name}</span>
					</div>
					{candidate.organisation && (
						<div className="managePeople__personMeta">
							{candidate.organisation}
						</div>
					)}
				</div>
				<div className="managePeople__personActions">
					<button
						type="button"
						className="managePeople__action"
						onClick={() => {
							setChosen(null);
							setReasonMissing(false);
						}}
					>
						{shared('otherPerson')}
					</button>
				</div>
			</div>
			<OrisoTextarea
				fullWidth
				minRows={3}
				value={reason}
				label={copy('reasonLabel')}
				placeholder={copy('reasonPlaceholder')}
				error={reasonMissing}
				helperText={reasonMissing ? copy('reasonMissing') : undefined}
				onChange={(event) => {
					setReason(event.target.value);
					if (event.target.value.trim()) {
						setReasonMissing(false);
					}
				}}
			/>
			<div className="managePeople__chosenActions">
				<button
					type="button"
					className="managePeople__action managePeople__action--primary"
					disabled={people.pendingId !== null}
					onClick={() => void submit(candidate)}
				>
					{people.pendingId !== null && (
						<CircularProgress size={16} color="inherit" />
					)}
					{shared(replacing ? 'replace.confirm' : 'add.confirm', {
						name: candidate.name
					})}
				</button>
			</div>
		</div>
	);

	const renderCandidates = () => {
		if (people.candidatesState === 'loading') {
			return (
				<p role="status" className="managePeople__state">
					{shared('loading')}
				</p>
			);
		}
		if (people.candidatesState === 'error') {
			return (
				<div role="alert" className="managePeople__state">
					{shared('error.candidates')}{' '}
					<button
						type="button"
						className="managePeople__action"
						onClick={() => void people.reload()}
					>
						{shared('retry')}
					</button>
				</div>
			);
		}
		if (people.candidates.length === 0) {
			return (
				<p className="managePeople__state">{copy('emptyCandidates')}</p>
			);
		}
		return (
			<>
				{people.candidates.length >= SEARCH_FROM_COUNT && (
					<OrisoTextField
						type="search"
						size="small"
						fullWidth
						label={shared('search')}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				)}
				{visibleCandidates.length === 0 ? (
					<p role="status" className="managePeople__state">
						{shared('noMatches')}
					</p>
				) : (
					<ul
						className="managePeople__list"
						aria-labelledby={pickerHeadingId}
					>
						{visibleCandidates.map((candidate) => (
							<li key={candidate.id}>
								<button
									type="button"
									className="managePeople__candidate"
									disabled={people.pendingId !== null}
									aria-label={shared(
										replacing
											? 'replace.pickLabelFor'
											: 'add.labelFor',
										{ name: candidate.name }
									)}
									onClick={() => pick(candidate)}
								>
									<UserAvatar
										username={candidate.name}
										displayName={candidate.name}
										userId={candidate.id}
										size={AVATAR_SIZE}
										ring={false}
									/>
									<span className="managePeople__personText">
										<span className="managePeople__personName">
											{candidate.name}
										</span>
										{candidate.organisation && (
											<span className="managePeople__personMeta">
												{candidate.organisation}
											</span>
										)}
									</span>
									<span className="managePeople__candidateAction">
										{people.pendingId === candidate.id ? (
											<CircularProgress size={18} />
										) : (
											shared(
												replacing
													? 'replace.pick'
													: 'add.action'
											)
										)}
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</>
		);
	};

	// Above the list, so the result of a click is seen without scrolling.
	const feedback = (
		<>
			{people.actionError && (
				<p role="alert" className="managePeople__error">
					{shared(`error.${people.actionError}`)}
				</p>
			)}
			<p role="status" className="managePeople__success">
				{people.added && copy('added', { name: people.added.name })}
			</p>
		</>
	);

	// Practice mode keeps its banner reachable while a dialog is open.
	const practiceControls = open
		? document.querySelector<HTMLElement>('[data-practice-controls]')
		: null;

	return (
		<M3Dialog
			open={open}
			onClose={onClose}
			title={copy('title')}
			description={copy('description')}
			closeLabel={translate('app.close')}
			reachableOutside={practiceControls}
			fullScreen={fullScreen}
			width={600}
			className="managePeople"
			data-testid="manage-people-dialog"
		>
			<section className="managePeople__section">
				<h3 className="managePeople__heading">
					{copy('membersTitle')}
				</h3>
				{renderMembers()}
			</section>

			{showPicker && (
				<section className="managePeople__section">
					<div className="managePeople__headingRow">
						<h3
							id={pickerHeadingId}
							className="managePeople__heading"
						>
							{replacing
								? shared('replace.title', {
										name: replacing.name
									})
								: copy('addTitle')}
						</h3>
						{replacing && (
							<button
								type="button"
								className="managePeople__action"
								onClick={resetPicker}
							>
								{shared('cancel')}
							</button>
						)}
					</div>
					{i18n.exists(`managePeople.${source.kind}.addNote`) && (
						<p className="managePeople__note">{copy('addNote')}</p>
					)}
					{feedback}
					{chosen ? renderChosen(chosen) : renderCandidates()}
				</section>
			)}

			{!showPicker && (
				<div className="managePeople__section">{feedback}</div>
			)}

			{inviteContent && (
				<section className="managePeople__section">
					<h3 className="managePeople__heading">
						{copy('inviteTitle')}
					</h3>
					<p className="managePeople__note">
						{copy('inviteDescription')}
					</p>
					{inviteContent}
				</section>
			)}
		</M3Dialog>
	);
};
