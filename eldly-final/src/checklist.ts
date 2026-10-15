/** Transcribed from the Week 8 Apple Notes screenshots. Monday = 0, Sunday = 6. */
export interface ChecklistRule {
  key: string;
  title: string;
  aliases?: string[];
  category: string;
  weekday: number;
  frequency: "once" | "weekly" | "odd" | "even" | "weeks";
  schoolWeeks?: number[];
  dueOffsetDays?: number;
  due?: string;
  deadline?: boolean;
  notes?: string;
}
export const CHECKLIST_START_WEEK = 8;
// Unmarked items are week-8-only, as confirmed by the owner.
// Saturday work is BEFORE the odd-week Wednesday: even work week, due 4 days later.
export const CHECKLIST_RULES: ChecklistRule[] = [
  {
    key: "prepare-361",
    title: "Prepare for quiz 361",
    aliases: ["Prepare for CS361 quiz"],
    category: "CS361",
    weekday: 0,
    frequency: "odd",
  },
  {
    key: "hw-361",
    title: "HW 361",
    aliases: ["CS361 homework reminder"],
    category: "CS361",
    weekday: 0,
    frequency: "weeks",
    schoolWeeks: [4, 7, 9, 12],
    dueOffsetDays: 2,
    notes:
      "Work on Monday in school weeks 4, 7, 9 and 12. Due Wednesday of that same week.",
  },
  {
    key: "quiz-361",
    title: "Quiz 361",
    aliases: ["CS361 quiz"],
    category: "CS361",
    weekday: 1,
    frequency: "odd",
  },
  {
    key: "lecture-342-tuesday",
    title: "342 lecture",
    aliases: ["CS342 lecture"],
    category: "CS342",
    weekday: 1,
    frequency: "weekly",
  },
  {
    key: "hw-342-tuesday",
    title: "342 HW",
    aliases: ["CS342 homework"],
    category: "CS342",
    weekday: 1,
    frequency: "once",
  },
  {
    key: "project-342-part1",
    title: "Part 1 project 2 342",
    aliases: ["CS342 project work", "CS342 Project 2 Part 1"],
    category: "CS342",
    weekday: 1,
    frequency: "once",
    due: "2026-10-18",
    deadline: true,
    notes:
      "Work on Tuesday in school week 8. The October 18 deadline is the same linked record, not a second Sunday task.",
  },
  {
    key: "lab-362-tuesday",
    title: "Lab 362",
    aliases: ["CS362 Lab"],
    category: "CS362",
    weekday: 1,
    frequency: "once",
  },
  {
    key: "sa",
    title: "SA",
    category: "Personal",
    weekday: 1,
    frequency: "once",
  },
  {
    key: "prepare-362",
    title: "Prepare for quiz 362",
    aliases: ["Prepare for CS362 quiz"],
    category: "CS362",
    weekday: 2,
    frequency: "odd",
  },
  {
    key: "prepare-342",
    title: "Prepare for quiz 342",
    aliases: ["Prepare for CS342 quiz"],
    category: "CS342",
    weekday: 2,
    frequency: "weeks",
    schoolWeeks: [4, 7, 10],
  },
  {
    key: "dator",
    title: "Dator",
    category: "Personal",
    weekday: 2,
    frequency: "once",
  },
  {
    key: "demo-lab5",
    title: "Demo lab5",
    aliases: ["Demo Lab 5"],
    category: "CS362",
    weekday: 2,
    frequency: "once",
  },
  {
    key: "lab-361-email",
    title: "Lab 361 and send email",
    aliases: ["CS361 lab and send email"],
    category: "CS361",
    weekday: 2,
    frequency: "once",
  },
  {
    key: "quiz-362",
    title: "Quiz 362",
    aliases: ["CS362 quiz"],
    category: "CS362",
    weekday: 3,
    frequency: "odd",
  },
  {
    key: "milestone-362",
    title: "Milestone 362",
    aliases: ["Check CS362 milestone after quiz"],
    category: "CS362",
    weekday: 3,
    frequency: "odd",
  },
  {
    key: "hw-342-thursday",
    title: "342 HW",
    aliases: ["Check CS342 homework deadline"],
    category: "CS342",
    weekday: 3,
    frequency: "weeks",
    schoolWeeks: [3, 7, 10, 12],
    dueOffsetDays: 3,
    notes:
      "Work on Thursday in school weeks 3, 7, 10 and 12. Due Sunday of that same week.",
  },
  {
    key: "lab-362-friday",
    title: "Lab 362",
    aliases: ["Work on CS362 lab"],
    category: "CS362",
    weekday: 4,
    frequency: "weekly",
    dueOffsetDays: 3,
    notes: "Work every Friday. Due the following Monday.",
  },
  {
    key: "lectures-361",
    title: "Go through 361 lectures with ChatGPT",
    aliases: ["Review CS361 lectures with ChatGPT"],
    category: "CS361",
    weekday: 4,
    frequency: "weekly",
  },
  {
    key: "lecture-342-friday",
    title: "Lecture 342",
    aliases: ["CS342 lecture"],
    category: "CS342",
    weekday: 4,
    frequency: "weekly",
  },
  {
    key: "hw-362",
    title: "HW 362",
    aliases: ["Work on CS362 homework"],
    category: "CS362",
    weekday: 5,
    frequency: "even",
    dueOffsetDays: 4,
    notes:
      "Work on the Saturday BEFORE the Wednesday deadline in an odd school week. Thus the work is in even school weeks, and the due date is four days later.",
  },
  {
    key: "grades",
    title: "Check my grades in all classes",
    aliases: ["Check grades in all classes"],
    category: "Personal",
    weekday: 6,
    frequency: "once",
  },
  {
    key: "laptop",
    title: "Laptop pickup",
    category: "Personal",
    weekday: 6,
    frequency: "once",
  },
];
// Remaining Important Dates from the earlier list. Project Part 1 is already linked above.
export const IMPORTANT_DATES = [
  {
    key: "evolutionary-medicine",
    due: "2026-10-23",
    title: "BIOS120 Evolutionary Medicine",
    category: "BIOS120",
  },
  {
    key: "project-part2",
    due: "2026-10-25",
    title: "Project Part 2 · course to confirm",
    category: "Other",
  },
  {
    key: "design-presentation",
    due: "2026-10-26",
    title: "CS362 Milestone Design Presentation",
    category: "CS362",
  },
  {
    key: "midterm2",
    due: "2026-10-28",
    title: "BIOS120 Midterm 2",
    category: "BIOS120",
  },
  {
    key: "paper",
    due: "2026-11-06",
    title: "BIOS120 Paper",
    category: "BIOS120",
  },
  {
    key: "group-project",
    due: "2026-11-09",
    title: "BIOS120 Group Project",
    category: "BIOS120",
  },
  {
    key: "lab7-report",
    due: "2026-11-11",
    title: "CS362 Lab 7 Report",
    category: "CS362",
  },
  {
    key: "assignment",
    due: "2026-11-20",
    title: "BIOS120 Assignment",
    category: "BIOS120",
  },
  {
    key: "milestone-presentation",
    due: "2026-11-23",
    title: "CS362 Milestone Presentation",
    category: "CS362",
  },
  {
    key: "midterm3",
    due: "2026-12-03",
    title: "BIOS120 Midterm 3",
    category: "BIOS120",
  },
];
