---
description: 'Performance best practices, lazy loading, memoization, and optimization techniques for ORISO Frontend'
alwaysApply: true
---

# Performance Optimization

## Overview

Performance optimization should be measured, not guessed. Focus on readability first, then optimize based on actual performance issues.

## Code Splitting

### React.lazy()

**Lazy load routes and heavy components:**

```typescript
// ✅ Good: Lazy loading routes
const Registration = lazy(() =>
	import('./components/registration/Registration').then((m) => ({
		default: m.Registration
	}))
);

// Usage with Suspense
<Suspense fallback={<Loading />}>
	<Registration />
</Suspense>
```

**See `src/initApp.tsx` for route lazy loading examples.**

### Dynamic Imports

**Use dynamic imports for heavy dependencies:**

```typescript
// ✅ Good: Dynamic import
const loadHeavyLibrary = async () => {
	const library = await import('./heavyLibrary');
	return library;
};
```

## Memoization

### React.memo()

**Use sparingly - only for expensive components:**

```typescript
// ✅ Good: Memoize expensive component
const ExpensiveComponent = React.memo(({ data }: Props) => {
	// Expensive rendering
	return <ComplexVisualization data={data} />;
});

// ❌ Bad: Unnecessary memoization
const SimpleComponent = React.memo(({ text }: Props) => {
	return <div>{text}</div>;  // Simple rendering, no memoization needed
});
```

**When to use React.memo:**

- Component renders frequently with same props
- Component has expensive rendering logic
- Component is in a list with many items

### useMemo()

**Only for expensive calculations:**

```typescript
// ✅ Good: Expensive calculation
const sortedItems = useMemo(() => {
	return items.sort((a, b) => {
		// Complex sorting logic
		return complexComparison(a, b);
	});
}, [items]);

// ❌ Bad: Simple calculation
const total = useMemo(() => {
	return items.reduce((sum, item) => sum + item.price, 0);
}, [items]); // Simple reduce, no memoization needed
```

### useCallback()

**Only when passing to memoized children:**

```typescript
// ✅ Good: Memoized callback for memoized child
const MemoizedChild = React.memo(({ onClick }: Props) => {
	// ...
});

const Parent = () => {
	const handleClick = useCallback(() => {
		// Handler logic
	}, [dependencies]);

	return <MemoizedChild onClick={handleClick} />;
};

// ❌ Bad: Unnecessary useCallback
const Parent = () => {
	const handleClick = useCallback(() => {
		console.log('clicked');
	}, []);  // No dependencies, no memoization needed

	return <RegularChild onClick={handleClick} />;
};
```

## Image Optimization

### Image Formats

**Use WebP format when possible:**

```typescript
// ✅ Good: WebP with fallback
<picture>
	<source srcSet="image.webp" type="image/webp" />
	<img src="image.jpg" alt="Description" />
</picture>
```

### Lazy Loading

**Lazy load images below the fold:**

```typescript
// ✅ Good: Lazy loading
<img
	src="image.jpg"
	alt="Description"
	loading="lazy"
/>
```

### Image Sizing

**Specify image dimensions:**

```typescript
// ✅ Good: Image dimensions
<img
	src="image.jpg"
	alt="Description"
	width={800}
	height={600}
/>
```

## Bundle Size Optimization

### Tree Shaking

**Use named imports:**

```typescript
// ✅ Good: Named imports (tree-shakeable)
import { Button, Input } from '@mui/material';

// ❌ Bad: Default import (not tree-shakeable)
import MUI from '@mui/material';
```

### Avoid Large Dependencies

**Check bundle size before adding dependencies:**

```bash
# Check bundle size
npm run build
# Analyze bundle
npx webpack-bundle-analyzer
```

## Re-render Prevention

### Dependency Arrays

**Check useEffect dependencies:**

```typescript
// ✅ Good: Correct dependencies
useEffect(() => {
	fetchData(userId);
}, [userId]); // Only re-run when userId changes

// ❌ Bad: Missing dependencies
useEffect(() => {
	fetchData(userId);
}, []); // Missing userId dependency
```

### State Updates

**Batch state updates:**

```typescript
// ✅ Good: Batched updates
const handleSubmit = () => {
	setFormData(newData);
	setIsSubmitting(false);
	setErrors({});
	// React batches these updates
};

// ❌ Bad: Separate renders
const handleSubmit = () => {
	setFormData(newData);
	setTimeout(() => setIsSubmitting(false), 0);
	setTimeout(() => setErrors({}), 0);
};
```

## Performance Measurement

### React DevTools Profiler

**Use React DevTools to measure performance:**

1. Open React DevTools
2. Go to Profiler tab
3. Record a session
4. Identify slow components
5. Optimize based on data

### Web Vitals

**Monitor Core Web Vitals:**

- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

## Anti-Patterns to Avoid

1. **Premature optimization**: Measure first, optimize second
2. **Over-memoization**: Don't memoize everything
3. **Missing dependencies**: Check useEffect dependencies
4. **Large bundles**: Monitor bundle size
5. **Unnecessary re-renders**: Check component dependencies
6. **Blocking renders**: Use Suspense for async components

## Checklist

When optimizing performance:

- [ ] Performance issue identified and measured
- [ ] Lazy loading used for routes/heavy components
- [ ] Memoization only where needed (measured)
- [ ] Images optimized (WebP, lazy loading, sizing)
- [ ] Bundle size monitored
- [ ] Re-renders minimized
- [ ] Dependencies correct in hooks
- [ ] Performance measured after changes

## References

- React Performance Optimization Guide
- `src/initApp.tsx` - Lazy loading examples
- React DevTools Profiler
- Web Vitals documentation
