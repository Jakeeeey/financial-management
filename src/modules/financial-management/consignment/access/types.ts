export type ConsignmentRole = "CREATOR" | "APPROVER" | "CONTROLLER";

export type ConsignmentAccess = {
  userId: number;
  role: ConsignmentRole | null;
  capabilities: string[];
  canManageRoles: boolean;
};

export type ConsignmentRoleAssignment = {
  userId: number;
  displayName: string;
  email: string | null;
  role: ConsignmentRole;
  assignedByUserId: number;
  createdAt: string;
  updatedAt: string;
};

export type ConsignmentUserOption = {
  userId: number;
  displayName: string;
  email: string | null;
};

export type ConsignmentPage<T> = {
  items: T[];
  page: number;
  size: number;
  hasNext: boolean;
};
