---
id: create-clickup-task
name: create-clickup-task
description: 'Create ClickUp Task'
when_to_use:
  - 'When starting work without a ClickUp task reference'
  - 'When the user needs to create a task for tracking work'
  - 'When the user says "create task" or "new task"'
workflow:
  - 'Gather context and assess scope (problem, component, effort)'
  - 'Draft task with metadata, title, and template sections'
  - 'Challenge scope and deliver final task with ClickUp link'
inputs:
  - 'Task title, description, and optional metadata (assignee, priority, list)'
outputs:
  - 'Created ClickUp task with ID and URL'
references:
  - .ai/rules/clickup-task.md
---

# Create Clickup Task Skill

## Instructions

Create or refine ClickUp tasks following Carrot workflow standards.

### Workflow: new task

1. **Gather context** — Ask: What problem? Which component? Who benefits? Expected effort?
2. **Assess scope** — Challenge effort >=5, question urgency, flag mixed deliverables
3. **Draft task** — Propose metadata, craft title, fill template per `.ai/rules/clickup-task.md`
4. **Deliver** — Outstanding questions, metadata summary, proposed title and body

### Workflow: refinement

1. **Analyze** — Check for missing metadata, vague TL;DR, generic value delivery
2. **Ask questions** — Do not assume; demand specifics
3. **Rewrite** — Strengthen weak language, add missing business rules, make DoD testable
4. **Challenge scope** — Suggest splits if needed

### Challenge points

- 5-pointer? → Split into smaller tasks
- "Improves X"? → Ask for metrics
- Urgent without blockers? → Question timeline
- DoD >8 items? → Reduce scope
