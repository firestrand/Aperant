# Scheduled Tasks Recurrence Decision

Phase 5 adopts a structured recurrence model instead of cron strings.

## Decision

Scheduled tasks support two explicit recurrence shapes:

- `daily` with `timeOfDay`
- `weekly` with `timeOfDay` and `daysOfWeek`

`timeOfDay` is interpreted in the user's local timezone because the settings UI collects local `HH:mm` values with a native time input. `nextRunAt` is persisted as an ISO timestamp after local-time calculation and rendered back to the user with local date/time formatting.

This is represented by `ScheduledTaskRecurrence` in `apps/desktop/src/shared/types/scheduled-task.ts`.

## Rationale

Structured daily/weekly recurrence is intentionally narrow for the first rollout. It keeps the renderer form simple, avoids adding a cron parser dependency, and makes duplicate-window prevention deterministic in `ScheduledTaskService`.

## Scope

The implementation is default-off behind `scheduledTasksEnabled`, creates normal spec-backed Aperant tasks, and can auto-start fired tasks only when project capacity allows. Over-capacity auto-starts are queued rather than bypassing the project task limit.
