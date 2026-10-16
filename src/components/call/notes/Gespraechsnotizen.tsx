import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ReactComponent as LockIcon } from '../../../resources/img/icons/lock.svg';
import { ReactComponent as KebabIcon } from '../../../resources/img/icons/stack-vertical.svg';
import { ReactComponent as TrashIcon } from '../../../resources/img/icons/trash.svg';
import { ReactComponent as CheckIcon } from '../../../resources/img/icons/check.svg';
import { ReactComponent as CollapseIcon } from '../../../resources/img/icons/arrow-right.svg';

/*
 * The ⋮ menu is the composer's menu, not a second one.
 *
 * Ticket 06 asks for "a `⋮` menu with exactly three types". The repository
 * already has that molecule — ToolbarButton + ToolbarMenu — and it already
 * solves the parts that are easy to get wrong: floating-ui placement that
 * flips instead of running off a phone screen, a body portal so the menu is
 * not clipped by an ancestor's overflow, Escape and outside-click to close,
 * and `menuitemradio` with `aria-checked` for a one-of-three choice.
 *
 * Rebuilding that here would have produced a fourth dropdown in this codebase
 * with its own bugs. The stylesheet comes along because the skin and the
 * primitive still live in the same file; it is a plain white M3 dropdown with
 * nothing composer-specific in it. Lifting those rules into a shared
 * stylesheet is worth doing, but it is a refactor of the composer, not of
 * this panel, so it is not smuggled in here.
 */
import { ToolbarButton } from '../../messageSubmitInterface/inputField/ToolbarButton';
import {
	ToolbarMenu,
	type ToolbarMenuItem
} from '../../messageSubmitInterface/inputField/ToolbarMenu';
import '../../messageSubmitInterface/inputField/composerToolbar.styles.scss';

import {
	addNote,
	asPlainText,
	NOTE_TYPES,
	removeNote,
	type Note,
	type NoteLabels,
	type NoteType
} from './notes';
import styles from './gespraechsnotizen.module.scss';

export interface GespraechsnotizenLabels {
	readonly title: string;
	/** The lock line. Says plainly that the notes are private and temporary. */
	readonly privacy: string;
	readonly type: string;
	readonly text: string;
	readonly add: string;
	readonly remove: string;
	readonly copy: string;
	readonly copied: string;
	readonly empty: string;
	readonly collapse: string;
	readonly expand: string;
	readonly types: NoteLabels;
}

export interface GespraechsnotizenProps {
	readonly labels: GespraechsnotizenLabels;
	/** Collapsed to the rail on first render. */
	readonly defaultCollapsed?: boolean;
	/**
	 * The clipboard, injectable.
	 *
	 * Not for convenience: this is the only way anything leaves the panel, so
	 * a test has to be able to see exactly what was handed over.
	 */
	readonly writeText?: (text: string) => Promise<void>;
	readonly className?: string;
}

/** How long the copy button stays acknowledged. */
const COPIED_FOR_MS = 2000;

/**
 * Gesprächsnotizen — the counsellor's private scratchpad, ticket 06.
 *
 * "Private is the feature. It is not a shared agenda, not a transcript, not
 * minutes." Everything here follows from that one line. The notes live in
 * component state and nowhere else: no fetch, no storage, no subscription,
 * no autosave. Unmount the panel and they are gone, which is the behaviour
 * the ticket asks for rather than an omission waiting to be fixed.
 *
 * The panel is a docked flex sibling of the stage, not a layer over it — at
 * 1280px the stage reflows to the remaining width instead of being covered.
 * Collapsed, it is a 44px rail and the notes survive the collapse.
 */
export const Gespraechsnotizen = ({
	labels,
	defaultCollapsed = false,
	writeText,
	className
}: GespraechsnotizenProps) => {
	const [notes, setNotes] = useState<readonly Note[]>([]);
	const [draftType, setDraftType] = useState<NoteType>('anmerkung');
	const [draftText, setDraftText] = useState('');
	const [collapsed, setCollapsed] = useState(defaultCollapsed);
	const [menuOpen, setMenuOpen] = useState(false);
	const [copied, setCopied] = useState(false);

	const anchorRef = useRef<HTMLSpanElement | null>(null);
	const nextId = useRef(0);

	// Acknowledging the copy is the one timer here; it must not outlive the
	// panel, or React warns about setting state after unmount.
	useEffect(() => {
		if (!copied) return;
		const timer = window.setTimeout(() => setCopied(false), COPIED_FOR_MS);
		return () => window.clearTimeout(timer);
	}, [copied]);

	const submit = useCallback(
		(event: React.FormEvent) => {
			event.preventDefault();
			nextId.current += 1;
			const next = addNote(
				notes,
				{ type: draftType, text: draftText },
				`note-${nextId.current}`
			);
			// addNote returns the SAME array for an empty draft. Clearing the
			// field only when something was actually added keeps a mis-click
			// from quietly eating a half-typed note.
			if (next === notes) return;
			setNotes(next);
			setDraftText('');
		},
		[notes, draftType, draftText]
	);

	const copy = useCallback(async () => {
		const text = asPlainText(notes, labels.types);
		const toClipboard =
			writeText ??
			((value: string) => navigator.clipboard.writeText(value));
		try {
			await toClipboard(text);
			setCopied(true);
		} catch {
			// A refused clipboard permission is not worth an error state the
			// counsellor cannot act on; the text is still on screen.
			setCopied(false);
		}
	}, [notes, labels.types, writeText]);

	const typeItems: ToolbarMenuItem[] = NOTE_TYPES.map((type) => ({
		key: type,
		label: labels.types[type],
		selected: type === draftType,
		exclusive: true,
		onSelect: () => setDraftType(type)
	}));

	return (
		<aside
			className={[styles.panel, className].filter(Boolean).join(' ')}
			data-testid="gespraechsnotizen"
			data-collapsed={collapsed}
			aria-label={labels.title}
		>
			<header className={styles.header}>
				{!collapsed && <h2 className={styles.title}>{labels.title}</h2>}
				<button
					type="button"
					className={styles.collapseButton}
					aria-label={collapsed ? labels.expand : labels.collapse}
					aria-expanded={!collapsed}
					onClick={() => setCollapsed((was) => !was)}
				>
					<CollapseIcon
						className={styles.collapseIcon}
						aria-hidden="true"
					/>
				</button>
			</header>

			{/* Collapsed, the panel keeps its notes in state and shows none of
			    them — a rail, as the ticket asks, not a reset. */}
			{!collapsed && (
				<>
					<p className={styles.privacy}>
						<LockIcon className={styles.lock} aria-hidden="true" />
						{labels.privacy}
					</p>

					<form className={styles.form} onSubmit={submit}>
						<input
							type="text"
							className={styles.text}
							aria-label={labels.text}
							value={draftText}
							onChange={(event) =>
								setDraftText(event.target.value)
							}
						/>
						<span
							className="composerToolbar__menuAnchor"
							ref={anchorRef}
						>
							<ToolbarButton
								// The current type belongs in the name, or a
								// screen reader cannot tell which of the three
								// the next note will be filed under.
								label={`${labels.type}: ${labels.types[draftType]}`}
								expanded={menuOpen}
								onClick={() => setMenuOpen((was) => !was)}
							>
								<KebabIcon aria-hidden="true" />
							</ToolbarButton>
						</span>
						{menuOpen && (
							<ToolbarMenu
								items={typeItems}
								direction="down"
								ariaLabel={labels.type}
								anchorEl={anchorRef.current}
								onClose={() => setMenuOpen(false)}
							/>
						)}
						<button type="submit" className={styles.add}>
							{labels.add}
						</button>
					</form>

					{notes.length === 0 ? (
						<p className={styles.empty}>{labels.empty}</p>
					) : (
						<ul className={styles.list}>
							{notes.map((note) => (
								<li
									key={note.id}
									className={styles.note}
									data-type={note.type}
									data-testid="note"
								>
									{/* The type is a word. A colour alone is
									    not a label, and in a hurry it is not
									    read at all. */}
									<span className={styles.noteType}>
										{labels.types[note.type]}
									</span>
									<span className={styles.noteText}>
										{note.text}
									</span>
									<button
										type="button"
										className={styles.remove}
										aria-label={labels.remove}
										onClick={() =>
											setNotes(removeNote(notes, note.id))
										}
									>
										<TrashIcon aria-hidden="true" />
									</button>
								</li>
							))}
						</ul>
					)}

					{/* An empty pad copies nothing, so the button has no
					    business existing yet. */}
					{notes.length > 0 && (
						<button
							type="button"
							className={styles.copy}
							onClick={copy}
						>
							{copied && (
								<CheckIcon
									className={styles.copyIcon}
									aria-hidden="true"
								/>
							)}
							{copied ? labels.copied : labels.copy}
						</button>
					)}
				</>
			)}
		</aside>
	);
};
