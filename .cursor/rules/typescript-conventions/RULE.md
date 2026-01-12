---
description: 'TypeScript patterns, type definitions, interfaces, and strict mode usage for ORISO Frontend'
globs: ['src/**/*.ts', 'src/**/*.tsx']
---

# TypeScript Conventions

## Overview

ORISO Frontend uses TypeScript with strict mode enabled (except `strictNullChecks: false` for legacy compatibility). All code must be properly typed.

## TypeScript Configuration

### Strict Mode

**Configuration in `tsconfig.json`:**

- `strict: true` - Enables all strict checks
- `strictNullChecks: false` - Disabled for legacy compatibility
- `noImplicitAny: false` - Disabled for gradual migration

**Always define types explicitly:**

```typescript
// ✅ Good: Explicit types
interface ButtonProps {
	item: ButtonItem;
	buttonHandle?: Function;
}

// ❌ Bad: Implicit any
const Button = (props) => {
	// props is any
};
```

## Interfaces vs Types

### Use Interfaces for Objects

**Prefer interfaces over types for object shapes:**

```typescript
// ✅ Good: Interface
interface UserData {
	id: string;
	name: string;
	email: string;
}

// ❌ Bad: Type for object
type UserData = {
	id: string;
	name: string;
	email: string;
};
```

### Use Types for Unions/Intersections

**Use types for unions, intersections, and computed types:**

```typescript
// ✅ Good: Type for union
type Status = 'pending' | 'approved' | 'rejected';

// ✅ Good: Type for intersection
type AdminUser = User & { role: 'admin' };

// ✅ Good: Type for computed
type UserKeys = keyof UserData;
```

## Naming Conventions

### Interfaces

**PascalCase with descriptive names:**

```typescript
// ✅ Good: Clear interface names
interface ButtonProps {
	// ...
}

interface UserDataInterface {
	// ...
}

interface ApiResponse {
	// ...
}
```

### Types

**PascalCase for types:**

```typescript
// ✅ Good: Type names
type ButtonType = 'primary' | 'secondary' | 'tertiary';
type EventHandler = (event: MouseEvent) => void;
```

## Props Interfaces

### Component Props

**Always define props interface:**

```typescript
// ✅ Good: Props interface
interface ButtonProps {
	item: ButtonItem;
	buttonHandle?: Function;
	disabled?: boolean;
	className?: string;
}

export const Button = (props: ButtonProps) => {
	// ...
};
```

**Naming: `ComponentNameProps`**

## Function Types

### Function Signatures

**Define function types explicitly:**

```typescript
// ✅ Good: Function type
type ButtonHandler = (functionName?: string, args?: object) => void;

interface ButtonProps {
	buttonHandle?: ButtonHandler;
}

// ✅ Good: Inline function type
interface ButtonProps {
	onClick: (event: MouseEvent) => void;
	onSubmit: (data: FormData) => Promise<void>;
}
```

### Event Handlers

**Type event handlers properly:**

```typescript
// ✅ Good: Typed event handlers
const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
	e.preventDefault();
	// ...
};

const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
	const value = e.target.value;
	// ...
};

const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
	if (e.key === 'Enter') {
		// ...
	}
};
```

## Generic Types

### Generic Functions

**Use generics for reusable functions:**

```typescript
// ✅ Good: Generic function
const fetchData = <T>(url: string): Promise<T> => {
	return fetch(url).then((res) => res.json());
};

// Usage
const userData = await fetchData<UserDataInterface>(endpoints.userData);
```

## Utility Types

### Common Utility Types

**Use TypeScript utility types:**

```typescript
// ✅ Good: Utility types
type PartialUser = Partial<UserData>;
type RequiredUser = Required<UserData>;
type UserKeys = keyof UserData;
type ReadonlyUser = Readonly<UserData>;
```

## Type Assertions

### Avoid Type Assertions

**Prefer type guards over assertions:**

```typescript
// ✅ Good: Type guard
const isUserData = (data: unknown): data is UserData => {
	return typeof data === 'object' && data !== null && 'id' in data;
};

if (isUserData(data)) {
	// data is UserData here
}

// ❌ Bad: Type assertion
const userData = data as UserData; // Unsafe!
```

## Enums

### Use Enums Sparingly

**Prefer union types over enums:**

```typescript
// ✅ Good: Union type
type BoxType = 'error' | 'info' | 'success';

// ❌ Bad: Enum (unless needed for reverse mapping)
enum BoxType {
	ERROR = 'error',
	INFO = 'info',
	SUCCESS = 'success'
}
```

**Enums are acceptable when:**

- Reverse mapping is needed
- Used in multiple files
- Part of external API

## Optional Properties

### Mark Optional Properties

**Use `?` for optional properties:**

```typescript
// ✅ Good: Optional properties
interface ButtonProps {
	item: ButtonItem;
	disabled?: boolean;
	className?: string;
	onClick?: (event: MouseEvent) => void;
}
```

## Return Types

### Explicit Return Types

**Define return types for functions:**

```typescript
// ✅ Good: Explicit return type
const calculateTotal = (items: Item[]): number => {
	return items.reduce((sum, item) => sum + item.price, 0);
};

// ✅ Good: Async return type
const fetchUserData = async (): Promise<UserDataInterface> => {
	// ...
};
```

## Import Types

### Type-Only Imports

**Use type-only imports when appropriate:**

```typescript
// ✅ Good: Type-only import
import type { UserDataInterface } from '../globalState/interfaces';

// ✅ Good: Mixed import
import { fetchData, type FetchDataProps } from './fetchData';
```

## Examples from Codebase

### Button Component Types

See `src/components/button/Button.tsx`:

```typescript
export interface ButtonItem {
	function?: string;
	functionArgs?: { [key: string]: any };
	disabled?: boolean;
	type: string;
}

export interface ButtonProps {
	item: ButtonItem;
	buttonHandle?: Function;
	disabled?: boolean;
}
```

### API Function Types

See `src/api/apiGetUserData.ts`:

```typescript
export const apiGetUserData = async (
	responseHandling?: string[]
): Promise<UserDataInterface> => {
	// ...
};
```

## Anti-Patterns to Avoid

1. **Any types**: Avoid `any`, use `unknown` if needed
2. **Missing types**: Always define types for props and functions
3. **Type assertions**: Use type guards instead
4. **Implicit any**: Always define types explicitly
5. **Overly complex types**: Keep types simple and readable

## Checklist

When writing TypeScript:

- [ ] All props have interfaces
- [ ] All functions have return types
- [ ] Event handlers properly typed
- [ ] No `any` types (use `unknown` if needed)
- [ ] Interfaces used for objects (not types)
- [ ] Types used for unions/intersections
- [ ] Optional properties marked with `?`
- [ ] Generic types used when appropriate

## References

- `tsconfig.json` - TypeScript configuration
- `src/components/button/Button.tsx` - Component types example
- `src/api/apiGetUserData.ts` - Function types example
- `src/globalState/interfaces/` - Interface definitions
