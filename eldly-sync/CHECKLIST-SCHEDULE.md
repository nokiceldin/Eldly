# Checklist from Apple Notes

School week 8 is October 12–18, 2026. Odd/even means school weeks, not ISO weeks.
The day column is when to WORK on the task. Due dates are separate information.

| Day | Task | Work weeks | Due |
| --- | --- | --- | --- |
| Monday | Prepare for quiz 361 | Odd | — |
| Monday | HW 361 | 4, 7, 9, 12 | Wednesday, same week |
| Tuesday | Quiz 361 | Odd | — |
| Tuesday | 342 lecture | Every week (W) | — |
| Tuesday | 342 HW | Week 8 only | — |
| Tuesday | Part 1 project 2 342 | Week 8 only | October 18, 2026 |
| Tuesday | Lab 362 | Week 8 only | — |
| Tuesday | SA | Week 8 only | — |
| Wednesday | Prepare for quiz 362 | Odd | — |
| Wednesday | Prepare for quiz 342 | 4, 7, 10 | — |
| Wednesday | Dator | Week 8 only | — |
| Wednesday | Demo lab5 | Week 8 only | — |
| Wednesday | Lab 361 and send email | Week 8 only | — |
| Thursday | Quiz 362 | Odd | — |
| Thursday | Milestone 362 | Odd | — |
| Thursday | 342 HW | 3, 7, 10, 12 | Sunday, same week |
| Friday | Lab 362 | Every week (W) | Following Monday |
| Friday | Go through 361 lectures with ChatGPT | Every week (W) | — |
| Friday | Lecture 342 | Every week (W) | — |
| Saturday | HW 362 | Even | Following Wednesday, in an odd week |
| Sunday | Check my grades in all classes | Week 8 only | — |
| Sunday | Laptop pickup | Week 8 only | — |

Unmarked tasks are week-8-only, as confirmed. They still carry forward if unfinished.
Saturday HW 362 is BEFORE the odd-week Wednesday, as confirmed: October 17 → October 21, October 31 → November 4.
Specific-week lists retain earlier weeks, but starter routines activate in week 8 to avoid inventing overdue work before setup.
Project Part 1 is one linked Tuesday work task and Sunday deadline, not two tasks.
The other sample Important Dates from October–December remain editable.

## Updating an existing installation

1. Export a backup in Options → Backup & settings.
2. Add the new src/checklist.ts file and replace all five other supplied files in one GitHub commit.
3. After Vercel deploys, refresh Checkly. Choose Options → Starter checklist → Update checklist from my notes, then accept the explanation.

This explicit update replaces old starter guesses, preserves personal tasks/routines and saved completed history, and does not repeat on every load. Earlier completed records retain their identities; matching replacement occurrences are suppressed to avoid counting twice. Customized items not marked as starter data stay yours.

To create a new every-week task, end its title with (W), (w) or ( w ). The app stores one routine, preserves the original task and shows the marker once. Other schedules are edited through Options → Repeating tasks.
