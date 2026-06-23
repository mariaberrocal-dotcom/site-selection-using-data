# PROJECT

## Product Purpose

This project is a site-evaluation interface for executive and project teams reviewing potential data center sites.

The product has two connected layers:

- `Summary Evaluation`: an executive-level overview that surfaces the most important risks, the overall recommendation, and checklist coverage.
- `Full Evaluation`: a deeper working surface organized by category, where users can inspect risks, findings, metrics, and detailed checklist assessments.

The core idea is that leaders should be able to start with a fast summary, then move into evidence without losing context.

## Current UX Principles

- Executive first: the first screen should feel like a decision-support readout, not a raw data dump.
- Connected detail: anything surfaced in the summary should trace back to the full evaluation.
- Same interaction language across views: flags, notes, severity, certainty, and view toggles should behave consistently in summary and full evaluation.
- Visual scanning matters: category chips, badges, icons, and color cues should help users differentiate risk types quickly.
- Compact but readable: cards should stay visually aligned, with truncation and layout rules that keep the interface tidy.
- Sticky navigation for long reports: users should always know where they are inside the full evaluation.
- Productized interactions: avoid browser-native prompts when the interaction is part of the actual UX.

## Current Priorities

- Keep the Builder branch state as the source of truth for the UI.
- Preserve parity between summary risk cards and full-evaluation risk cards.
- Make flagged risks feel intentional: flagging should clearly communicate that a risk is being surfaced into the Summary Evaluation.
- Improve navigation confidence inside Full Evaluation, especially sticky category and section navigation.
- Keep the visual system consistent: Inter font, 14px CTA scale, tighter badge heights, 40px header controls, 10px shell radius, and the current Civarea branding treatment.
- Ensure the app remains runnable as a simple static frontend served locally.

## Risk Translation Framework Summary

The product currently translates imported evaluation data into a more decision-friendly structure:

- Raw domain data is grouped into major evaluation categories such as Land & Constructability, Zoning, Power & Energy, Water, Environmental, Climate, Financial, and Community.
- Risks are normalized into common fields:
  - title
  - summary
  - category
  - severity
  - certainty
  - sources
  - domain mapping
- Risk categories are inferred and normalized so the UI can present them consistently even when source data is uneven.
- Flagging is used as the bridge between detailed findings and the executive summary.
- Notes are treated as lightweight analyst context attached to a specific risk.

In practice, the framework is meant to turn a large imported site-evaluation payload into a smaller set of understandable, comparable decision objects.

## Summary Evaluation Philosophy

The Summary Evaluation is not meant to mirror the full report one-to-one.

Its purpose is to:

- surface the most important risks
- communicate the recommendation clearly
- show why the site is or is not viable
- give executives enough confidence to decide whether to continue, escalate, or reject

The current design direction treats the summary cards as risks that have effectively been surfaced from the full evaluation. That is why flags, notes, severity, certainty, and category language should remain aligned between the two views.

The summary should feel curated, not exhaustive.

## Known Unresolved Questions

- What is the final source-of-truth rule between automatically imported risks and user-flagged risks in the Summary Evaluation?
- Should summary cards always represent only flagged risks, or should some system-prioritized risks remain there by default?
- How should notes persist long term: local session state only, browser storage, backend storage, or exportable metadata?
- What should the `Site Files` button do in the final product?
- What is the desired behavior for `Add Risk` in the summary workflow?
- Should the full-evaluation section spy be based on click intent, viewport midpoint, or sticky-threshold logic?
- What are the final category colors and icon mappings approved for production?
- Should the app eventually support editing, deleting, and reordering surfaced summary risks explicitly?
- How should exports reflect user state such as flags and notes?
- Is `main` intended to stay behind Builder work, or should Builder branches be merged back into `main` on a regular cadence?

