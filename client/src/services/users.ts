import { api } from "@/lib/api";

export interface User {
  id: string;
  username: string;
  email: string;
  role: "admin" | "operator" | "viewer";
  authMethod: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  role: "admin" | "operator" | "viewer";
  mustChangePassword?: boolean;
}

export interface UpdateUserData {
  email?: string;
  role?: "admin" | "operator" | "viewer";
  isActive?: boolean;
  mustChangePassword?: boolean;
}

export const userService = {
  // Get all users (admin only)
  async getUsers(): Promise<User[]> {
    const response = await api.get<{ users: User[] }>("/users");
    return response.users;
  },

  // Get single user
  async getUser(id: string): Promise<User> {
    const response = await api.get<{ user: User }>(`/users/${id}`);
    return response.user;
  },

  // Create new user (admin only)
  async createUser(data: CreateUserData): Promise<User> {
    const response = await api.post<{ user: User }>("/users", data);
    return response.user;
  },

  // Update user (admin only)
  async updateUser(id: string, data: UpdateUserData): Promise<User> {
    const response = await api.put<{ user: User }>(`/users/${id}`, data);
    return response.user;
  },

  // Delete user (admin only)
  async deleteUser(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  // Reset user password (admin only)
  async resetPassword(id: string, newPassword: string): Promise<void> {
    await api.post(`/users/${id}/reset-password`, { newPassword });
  },

  // Toggle user active status
  async toggleActive(id: string, isActive: boolean): Promise<User> {
    const response = await api.patch<{ user: User }>(`/users/${id}`, { isActive });
    return response.user;
  },
};
