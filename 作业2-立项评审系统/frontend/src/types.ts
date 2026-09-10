export type Role = "student" | "reviewer" | "admin";

export interface User {
  id: number;
  email: string;
  role: Role;
  created_at?: string;
}

export type ProjectStatus = "draft" | "submitted" | "reviewing" | "reviewed";

export interface Project {
  id: number;
  student_id: number;
  title: string;
  description: string;
  tech_stack: string;
  team_size: number;
  status: ProjectStatus;
  created_at?: string;
  updated_at?: string;
  student?: User;
}

export interface ProjectInput {
  title: string;
  description: string;
  tech_stack: string;
  team_size: number;
}

export type Conclusion = "pass" | "fail" | "revise";

export interface Review {
  reviewer_id: number;
  innovation: number;
  technology: number;
  value: number;
  comment: string;
  conclusion: Conclusion;
  score: number;
}

export interface ReviewResult {
  status: ProjectStatus;
  reviews: Review[];
  avg_score: number;
}

export interface ProgressItem {
  project: Project;
  assigned: number;
  reviewed: number;
}

export interface ResultItem {
  project: Project;
  avg_score: number;
  count: number;
}

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "草稿",
  submitted: "已提交",
  reviewing: "评审中",
  reviewed: "已评审",
};

export const ROLE_LABEL: Record<Role | "", string> = {
  student: "学生",
  reviewer: "评委",
  admin: "管理员",
  "": "-",
};
