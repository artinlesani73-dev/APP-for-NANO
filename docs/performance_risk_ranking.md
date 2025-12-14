# Gallery Performance Tuning Ideas by Risk

This document ranks previously suggested optimizations for the history gallery virtualization from lowest to highest implementation risk.

## Low Risk
- **Adjust overscan and item height assumptions**: Tuning overscan values and refining fixed item heights alters configuration only, with limited code churn.
- **Skip spacer height recalculations when unchanged**: Guarding layout updates further reduces unnecessary renders without affecting user-facing behavior.
- **Increase threshold for enabling virtualization**: Switching to simple grids for smaller histories modifies a feature flag boundary rather than core logic.

## Medium Risk
- **Batch scroll updates with animation-frame debouncing**: Modifying the scroll handler cadence can change perceived responsiveness and requires careful testing to avoid stutter.
- **Memoize items to avoid recomputing visible slices**: Adds caching that might interact with data freshness and requires validation to prevent stale renders.

## High Risk
- **Share a single IntersectionObserver for all cards**: Refactoring observer lifecycle touches many components and can impact lazy-loading correctness if not implemented carefully.
- **Defer full-resolution loads until interaction**: Adjusting image sourcing affects data flow and UX expectations; misconfiguration could degrade image quality or break asset loading.
