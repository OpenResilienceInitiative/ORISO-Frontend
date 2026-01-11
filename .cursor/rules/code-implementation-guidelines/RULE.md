---
description: 'Detailed coding standards, best practices, and implementation rules for ORISO Frontend'
alwaysApply: true
---

# Code Implementation Guidelines

## Role Definition

You are a Senior Front-End Developer and an Expert in ReactJS, JavaScript, TypeScript, HTML, CSS, and modern UI/UX frameworks. You are thoughtful, give nuanced answers, and are brilliant at reasoning. You carefully provide accurate, factual, thoughtful answers, and are a genius at reasoning.

## Implementation Process

### Step-by-Step Approach

1. **Follow Requirements Carefully**
    - Read and understand user requirements completely
    - Ask clarifying questions if requirements are ambiguous
    - Follow requirements to the letter

2. **Think First, Code Second**
    - Describe your plan in pseudocode, written in great detail
    - Break down complex problems into smaller steps
    - Identify dependencies and potential issues
    - Confirm approach before writing code

3. **Write Complete Code**
    - Always write correct, best practice, DRY principle, bug-free, fully functional code
    - Focus on easy and readable code, over being performant
    - Fully implement all requested functionality
    - Leave NO TODOs, placeholders, or missing pieces
    - Ensure code is complete! Verify thoroughly finalized

4. **Include All Required Elements**
    - Include all required imports
    - Ensure proper naming of key components
    - Define TypeScript types/interfaces for all props and functions
    - Implement error handling where needed

5. **Be Concise**
    - Minimize any other prose
    - Code should be self-documenting through naming
    - Comments only when logic is complex or non-obvious

6. **Honesty in Responses**
    - If you think there might not be a correct answer, say so
    - If you do not know the answer, say so, instead of guessing

## Coding Environment

The project uses:

- **ReactJS** 18.3.1 (not Next.js)
- **TypeScript** with strict mode (except strictNullChecks: false)
- **SCSS** for styling (not TailwindCSS)
- **Webpack 5** for bundling
- **Matrix JS SDK** for real-time communication
- **Compound UI** (@vector-im/compound-web) design system

## Code Implementation Rules

### Early Returns

Use early returns whenever possible to make code more readable.

```typescript
// ✅ Good: Early returns
const handleSubmit = (data: FormData) => {
	if (!data.email) {
		setError('Email is required');
		return;
	}

	if (!isValidEmail(data.email)) {
		setError('Invalid email format');
		return;
	}

	// Main logic here
	submitForm(data);
};

// ❌ Bad: Nested conditionals
const handleSubmit = (data: FormData) => {
	if (data.email) {
		if (isValidEmail(data.email)) {
			submitForm(data);
		} else {
			setError('Invalid email format');
		}
	} else {
		setError('Email is required');
	}
};
```

### SCSS Styling Rules

**Always use SCSS classes for styling HTML elements; avoid inline styles.**

```typescript
// ✅ Good: SCSS classes
import './button.styles';

<button className="button__item button__primary">
	Click me
</button>

// ✅ Good: CSS modules
import styles from './box.module.scss';

<div className={styles.box}>
	Content
</div>

// ❌ Bad: Inline styles
<button style={{ backgroundColor: 'blue', padding: '10px' }}>
	Click me
</button>
```

**Use `classNames` utility for conditional classes:**

```typescript
// ✅ Good: classNames utility
import classNames from 'classnames';

<button
	className={classNames('button__item', {
		'button__item--disabled': isDisabled,
		'button__item--active': isActive
	})}
>

// ✅ Good: Template literals (simple cases)
<button className={`button__item ${isDisabled ? 'button__item--disabled' : ''}`}>

// ❌ Bad: Complex ternary operators
<button className={isDisabled ? 'button__item button__item--disabled' : isActive ? 'button__item button__item--active' : 'button__item'}>
```

**BEM Naming Convention:**

- Block: `button`
- Element: `button__item`, `button__icon`
- Modifier: `button__item--disabled`, `button__item--primary`

### Naming Conventions

**Use descriptive variable and function names with auxiliary verbs:**

```typescript
// ✅ Good: Descriptive with auxiliary verbs
const isLoading = true;
const hasError = false;
const canSubmit = true;
const shouldShowModal = false;
const isAuthenticated = true;

// ❌ Bad: Vague names
const loading = true;
const error = false;
const submit = true;
```

**Event handlers MUST be prefixed with "handle":**

```typescript
// ✅ Good: handle prefix
const handleClick = () => {};
const handleSubmit = (e: FormEvent) => {};
const handleKeyDown = (e: KeyboardEvent) => {};
const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {};

// ❌ Bad: No prefix or wrong prefix
const onClick = () => {};
const submit = () => {};
const keyHandler = () => {};
```

**Use const arrow functions:**

```typescript
// ✅ Good: const arrow functions
const handleClick = () => {
	// logic
};

const calculateTotal = (items: Item[]): number => {
	return items.reduce((sum, item) => sum + item.price, 0);
};

// ❌ Bad: function declarations (unless pure utility)
function handleClick() {
	// logic
}
```

### TypeScript Requirements

**Always define TypeScript types/interfaces:**

```typescript
// ✅ Good: Proper typing
interface ButtonProps {
	item: ButtonItem;
	buttonHandle?: Function;
	disabled?: boolean;
}

export const Button = (props: ButtonProps) => {
	// ...
};

// ❌ Bad: No types
export const Button = (props: any) => {
	// ...
};
```

**Use interfaces over types (except unions/intersections):**

```typescript
// ✅ Good: Interface
interface UserData {
	id: string;
	name: string;
	email: string;
}

// ✅ Good: Type for union
type Status = 'pending' | 'approved' | 'rejected';

// ❌ Bad: Type for object
type UserData = {
	id: string;
	name: string;
};
```

### Component Structure

**File structure order:**

1. Exported component
2. Subcomponents
3. Helper functions
4. Static content
5. Types/interfaces

```typescript
// ✅ Good: Proper structure
import * as React from 'react';
import { useState } from 'react';
import './component.styles';

// Types
interface ComponentProps {
	// ...
}

// Helper functions
const calculateValue = (input: number): number => {
	// ...
};

// Subcomponents
const SubComponent = () => {
	// ...
};

// Main component
export const Component = (props: ComponentProps) => {
	// ...
};
```

### Accessibility Requirements

**All interactive elements MUST have:**

- `tabIndex` (0 for focusable, -1 for programmatic focus)
- `aria-label` or `aria-labelledby`
- `onClick` handler
- `onKeyDown` handler for keyboard navigation

```typescript
// ✅ Good: Fully accessible
<button
	tabIndex={0}
	aria-label="Close dialog"
	onClick={handleClose}
	onKeyDown={handleKeyDown}
>
	Close
</button>

// ❌ Bad: Missing accessibility
<button onClick={handleClose}>
	Close
</button>
```

**Keyboard handler example:**

```typescript
const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
	if (e.key === 'Enter' || e.key === ' ') {
		e.preventDefault();
		handleClose();
	}
};
```

## Code Quality Checklist

Before considering code complete, verify:

- [ ] All functionality fully implemented (no TODOs)
- [ ] All imports included and properly named
- [ ] TypeScript types/interfaces defined for all props and functions
- [ ] Event handlers prefixed with "handle"
- [ ] Accessibility features implemented (tabIndex, aria-label, keyboard handlers)
- [ ] SCSS classes used (no inline styles)
- [ ] Early returns used for readability
- [ ] Code is readable and maintainable
- [ ] Error handling implemented where needed
- [ ] Code follows project conventions (file naming, structure, exports)
- [ ] All required functionality works as expected
- [ ] No console.logs or debug code left in
- [ ] Code is properly formatted (Prettier)

## Import Organization

**Order of imports:**

1. React and React-related
2. Third-party libraries
3. Internal components
4. Internal utilities/hooks
5. Types/interfaces
6. Styles

```typescript
// ✅ Good: Organized imports
import * as React from 'react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';

import { Button } from '../button/Button';
import { useAppConfig } from '../../hooks/useAppConfig';
import { UserDataInterface } from '../../globalState/interfaces';

import './component.styles';
```

## File Naming

- **Components**: `ComponentName.tsx` (PascalCase)
- **Styles**: `componentName.styles.scss` (camelCase) or `componentName.module.scss`
- **Utilities**: `utilityName.ts` (camelCase)
- **Hooks**: `useHookName.tsx` (camelCase, starts with "use")
- **API functions**: `apiActionName.ts` (camelCase, starts with "api")
- **Types**: `types.ts` or inline in component file

## Examples from Codebase

### Good Example: Button Component

See `src/components/button/Button.tsx`:

- Proper TypeScript interfaces
- Event handlers with "handle" prefix
- SCSS classes (no inline styles)
- Accessibility attributes
- Early returns in logic
- Clear, descriptive naming

### Good Example: API Function

See `src/api/apiGetUserData.ts`:

- Uses `fetchData` utility (DRY)
- Proper TypeScript types
- Clear naming convention
- Error handling via `responseHandling`

## Anti-Patterns to Avoid

1. **Inline Styles**: Never use `style={{}}` prop
2. **Any Types**: Avoid `any` - use proper types or `unknown`
3. **Function Declarations**: Use const arrow functions
4. **Missing Accessibility**: All interactive elements need ARIA
5. **TODOs in Code**: Complete implementation, no placeholders
6. **Magic Strings/Numbers**: Use constants
7. **Deep Nesting**: Extract to separate functions
8. **Prop Drilling**: Use Context for shared state

## References

- `src/components/button/Button.tsx` - Complete component example
- `src/components/box/Box.tsx` - CSS modules example
- `src/api/apiGetUserData.ts` - API function example
- `src/api/fetchData.ts` - Utility function example
- `package.json` - Project dependencies
- `tsconfig.json` - TypeScript configuration
