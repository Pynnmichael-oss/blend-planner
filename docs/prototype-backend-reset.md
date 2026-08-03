# Prototype backend reset

This branch updates Blend Planner saves for the simplified Fort Worth Supabase backend.

- Every save inserts a new `blend_plans` row with `status = planned`.
- The Planner does not assign the Fort Worth blend number.
- Incoming RVP, target RVP, planned butane, truck count, predicted final RVP, inventory estimates, tank identity, and operating windows are saved as columns and in `planner_snapshot`.
- Existing saved rows are not overwritten.

Use the same Supabase project URL and publishable key as the Terminal Dashboard replacement branch.
