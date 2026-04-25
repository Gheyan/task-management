export type Status = "todo" | "in-progress" | "done";

export type Task = {
  id: string;
  title: string;
  status: Status;
};

export const COLUMNS: Status[] = ["todo", "in-progress", "done"];