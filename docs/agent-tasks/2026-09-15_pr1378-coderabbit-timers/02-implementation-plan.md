# Implementation plan

Use Vitest fake timers and an act-wrapped advance helper. Drive assertion polling with the virtual clock because RTL real-timer polling cannot advance it. Share AUTO_READ_DEBOUNCE_MS with the provider rather than using a 400ms margin. Clear timers and restore real timers after component/store cleanup.

Validate both provider test files, scripts/style lint and the requested repository gates. Verify current remote head before a normal fast-forward push to claude/timeline-analysis-filter-il7z7b.
