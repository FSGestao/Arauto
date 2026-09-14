export interface User {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  role: "SUPERADMIN" | "USER";
  createdAt: string;
}

export interface AccessRequest {
  id: number;
  email: string;
  churchName: string;
  message: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
}
