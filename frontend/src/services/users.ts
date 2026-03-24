import { User } from "@/lib/types";
import { apiRequest } from "@/services/api";

export function listUsers() {
  return apiRequest<User[]>("auth/users/");
}

