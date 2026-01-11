---
description: 'Accessibility requirements, ARIA attributes, keyboard navigation, and screen reader support for ORISO Frontend'
globs: ['src/components/**/*.tsx']
---

# Accessibility

## Overview

All interactive elements must be accessible to users with disabilities. This includes keyboard navigation, screen reader support, and proper ARIA attributes.

## Required Accessibility Features

### All Interactive Elements

**Every interactive element MUST have:**

- `tabIndex` (0 for focusable, -1 for programmatic focus)
- `aria-label` or `aria-labelledby`
- `onClick` handler
- `onKeyDown` handler for keyboard navigation

```typescript
// ✅ Good: Fully accessible button
<button
	tabIndex={0}
	aria-label="Close dialog"
	onClick={handleClose}
	onKeyDown={handleKeyDown}
>
	Close
</button>
```

### Keyboard Handler

**Implement keyboard navigation:**

```typescript
// ✅ Good: Keyboard handler
const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
	if (e.key === 'Enter' || e.key === ' ') {
		e.preventDefault();
		handleClose();
	}
};
```

## ARIA Attributes

### aria-label

**Use aria-label for elements without visible text:**

```typescript
// ✅ Good: aria-label for icon button
<button
	aria-label="Close dialog"
	onClick={handleClose}
>
	<CloseIcon />
</button>
```

### aria-labelledby

**Use aria-labelledby when label exists elsewhere:**

```typescript
// ✅ Good: aria-labelledby
<div id="dialog-title">Settings</div>
<div role="dialog" aria-labelledby="dialog-title">
	Content
</div>
```

### aria-hidden

**Hide decorative elements from screen readers:**

```typescript
// ✅ Good: aria-hidden for decorative icons
<span className="inputField__icon" aria-hidden="true">
	<Icon />
</span>
```

### aria-describedby

**Link descriptions to form inputs:**

```typescript
// ✅ Good: aria-describedby
<input
	id="email"
	aria-describedby="email-error"
/>
{error && (
	<div id="email-error" role="alert">
		{error}
	</div>
)}
```

## Form Accessibility

### Labels

**All form inputs must have labels:**

```typescript
// ✅ Good: Proper label
<label htmlFor="email" className="inputField__label">
	Email
</label>
<input
	id="email"
	name="email"
	type="email"
/>
```

### Error Messages

**Link error messages to inputs:**

```typescript
// ✅ Good: Error message with aria
<input
	id="email"
	aria-invalid={hasError}
	aria-describedby={hasError ? "email-error" : undefined}
/>
{hasError && (
	<div id="email-error" role="alert" className="error-message">
		{errorMessage}
	</div>
)}
```

### Required Fields

**Indicate required fields:**

```typescript
// ✅ Good: Required field indication
<label htmlFor="email">
	Email <span aria-label="required">*</span>
</label>
<input
	id="email"
	required
	aria-required="true"
/>
```

## Keyboard Navigation

### Tab Order

**Ensure logical tab order:**

```typescript
// ✅ Good: Logical tab order
<button tabIndex={0}>First</button>
<button tabIndex={0}>Second</button>
<button tabIndex={0}>Third</button>
```

### Focus Management

**Manage focus for modals and dialogs:**

```typescript
// ✅ Good: Focus management
const Modal = ({ isOpen, onClose }) => {
	const modalRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (isOpen && modalRef.current) {
			modalRef.current.focus();
		}
	}, [isOpen]);

	return (
		<div
			ref={modalRef}
			role="dialog"
			aria-modal="true"
			tabIndex={-1}
		>
			Content
		</div>
	);
};
```

### Keyboard Shortcuts

**Support standard keyboard shortcuts:**

- `Enter` or `Space` - Activate button/link
- `Escape` - Close modal/dialog
- `Tab` - Navigate forward
- `Shift+Tab` - Navigate backward
- Arrow keys - Navigate lists/menus

## Images

### Alt Text

**All images must have alt text or aria-hidden:**

```typescript
// ✅ Good: Alt text for meaningful images
<img src="logo.png" alt="ORISO Logo" />

// ✅ Good: aria-hidden for decorative images
<img src="decoration.png" aria-hidden="true" alt="" />
```

### SVG Icons

**SVG icons need accessibility:**

```typescript
// ✅ Good: Accessible SVG
<svg
	aria-label="Close"
	role="img"
	onClick={handleClose}
	onKeyDown={handleKeyDown}
>
	<path d="..." />
</svg>
```

## Semantic HTML

### Use Semantic Elements

**Prefer semantic HTML:**

```typescript
// ✅ Good: Semantic HTML
<header>
	<nav>
		<ul>
			<li><a href="/">Home</a></li>
		</ul>
	</nav>
</header>
<main>
	<article>
		<h1>Title</h1>
		<p>Content</p>
	</article>
</main>
<footer>Footer</footer>

// ❌ Bad: Div soup
<div>
	<div>
		<div>Home</div>
	</div>
</div>
```

## Focus Indicators

### Visible Focus

**Ensure focus is visible:**

```scss
// ✅ Good: Visible focus
.button:focus {
	outline: 2px solid var(--skin-color-primary);
	outline-offset: 4px;
}

.button:focus:not(:focus-visible) {
	outline: none;
}
```

## Screen Reader Support

### Role Attributes

**Use role attributes when needed:**

```typescript
// ✅ Good: Role attributes
<div role="alert" aria-live="polite">
	{notification}
</div>

<div role="dialog" aria-modal="true">
	Modal content
</div>
```

### Live Regions

**Use aria-live for dynamic content:**

```typescript
// ✅ Good: Live region
<div aria-live="polite" aria-atomic="true">
	{statusMessage}
</div>
```

## Examples from Codebase

### Button Component

See `src/components/button/Button.tsx`:

- `aria-label` from `item.title`
- `tabIndex` support
- Keyboard navigation ready

### InputField Component

See `src/components/inputField/InputField.tsx`:

- Proper label association
- Error state handling
- Keyboard support

## Anti-Patterns to Avoid

1. **Missing aria-label**: All interactive elements need labels
2. **No keyboard support**: All interactions must work with keyboard
3. **Missing focus indicators**: Focus must be visible
4. **Div soup**: Use semantic HTML
5. **Images without alt**: All images need alt or aria-hidden
6. **No error announcements**: Link errors to inputs
7. **Broken tab order**: Ensure logical navigation

## Checklist

When creating components:

- [ ] All interactive elements have tabIndex
- [ ] All interactive elements have aria-label
- [ ] Keyboard handlers implemented (onKeyDown)
- [ ] Form inputs have labels
- [ ] Error messages linked to inputs (aria-describedby)
- [ ] Images have alt text or aria-hidden
- [ ] Focus indicators visible
- [ ] Semantic HTML used
- [ ] Screen reader tested (if possible)

## References

- WCAG 2.1 AA Guidelines
- `src/components/button/Button.tsx` - Accessible button example
- `src/components/inputField/InputField.tsx` - Accessible form example
- MDN ARIA documentation
