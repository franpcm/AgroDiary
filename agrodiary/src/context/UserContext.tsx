"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Usuario } from "@/types";

interface UserContextType {
  users: Usuario[];
  currentUser: Usuario | null;
  setCurrentUser: (user: Usuario) => void;
  refreshUsers: () => Promise<unknown>;
  loading: boolean;
}

const UserContext = createContext<UserContextType>({
  users: [],
  currentUser: null,
  setCurrentUser: () => {},
  refreshUsers: async () => [],
  loading: true,
});

const STORAGE_KEY = "agrodiary_current_user";

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [currentUser, setCurrentUserState] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data);
      return data as Usuario[];
    } catch (err) {
      console.error("Error loading users:", err);
      return [];
    }
  }, []);

  useEffect(() => {
    refreshUsers().then((fetchedUsers) => {
      // Restore saved user from localStorage
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId && fetchedUsers.length > 0) {
        const found = fetchedUsers.find((u: Usuario) => u.id === savedId);
        if (found) {
          setCurrentUserState(found);
        } else {
          setCurrentUserState(fetchedUsers[0]);
        }
      } else if (fetchedUsers.length > 0) {
        setCurrentUserState(fetchedUsers[0]);
      }
      setLoading(false);
    });
  }, [refreshUsers]);

  const setCurrentUser = (user: Usuario) => {
    setCurrentUserState(user);
    localStorage.setItem(STORAGE_KEY, user.id);
  };

  return (
    <UserContext.Provider
      value={{ users, currentUser, setCurrentUser, refreshUsers, loading }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
