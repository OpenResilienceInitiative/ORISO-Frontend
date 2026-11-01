import * as React from 'react';
import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { InsertionMarker, insertionMarkerKey } from './insertionMarker';
import '../../TipTapComposer.styles.scss';

/**
 * #996 — recording a voice message types nothing into the editor, so without
 * this dot the counsellor cannot see where in a half-written message the
 * recording is going to land. Shown here on its own, away from the microphone
 * permission prompt a real recording needs.
 */
const MarkerHarness = ({
	text,
	markerAt
}: {
	text: string;
	markerAt: number | null;
}) => {
	const editor = useEditor({
		extensions: [StarterKit, InsertionMarker],
		content: `<p>${text}</p>`,
		editable: true
	});
	const editorRef = useRef<Editor | null>(null);
	editorRef.current = editor ?? null;

	useEffect(() => {
		const current = editorRef.current;
		if (!current || current.isDestroyed) {
			return;
		}
		current.view.dispatch(
			current.state.tr.setMeta(insertionMarkerKey, markerAt)
		);
	}, [markerAt, editor]);

	return (
		<div
			style={{
				width: 620,
				padding: 16,
				border: '1px solid var(--m3-primary-fixed, #ffdad5)',
				borderRadius: '24px 4px 24px 24px',
				background: 'var(--m3-surface-container-lowest, #fff)'
			}}
		>
			<EditorContent editor={editor} />
		</div>
	);
};

const meta = {
	title: 'Components/Composer/InsertionMarker',
	component: MarkerHarness,
	parameters: {
		docs: {
			description: {
				component:
					'The dot marking where a voice message will be inserted. It is a decoration, never document content, and it maps through every transaction so it follows the text as the user keeps typing.'
			}
		}
	}
} satisfies Meta<typeof MarkerHarness>;

export default meta;
type Story = StoryObj<typeof MarkerHarness>;

export const NoInsertionPending: Story = {
	args: {
		text: 'Guten Tag, ich melde mich zu Ihrer Anfrage.',
		markerAt: null
	}
};

export const MarkerAtTheCaret: Story = {
	name: 'Recording pending — dot marks the spot',
	args: {
		text: 'Guten Tag, ich melde mich zu Ihrer Anfrage.',
		markerAt: 12
	}
};

export const MarkerAtTheEnd: Story = {
	name: 'Recording pending — dot at the end of the message',
	args: {
		text: 'Guten Tag, ich melde mich zu Ihrer Anfrage.',
		markerAt: 43
	}
};
