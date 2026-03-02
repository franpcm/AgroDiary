"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import type { Usuario } from "@/types";
import { AVATAR_COLORS } from "@/types";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/diario", label: "Diario", icon: "📝" },
  { href: "/parcelas", label: "Parcelas / Mapa", icon: "🗺️" },
  { href: "/calendario", label: "Calendario", icon: "📅" },
  { href: "/historico", label: "Histórico", icon: "📈" },
  { href: "/asistente", label: "Asistente IA", icon: "🤖" },
  { href: "/conocimiento", label: "Base Conocimiento", icon: "📚" },
  { href: "/exportar", label: "Cuaderno de Campo", icon: "📋" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { users, currentUser, setCurrentUser, refreshUsers } = useUser();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserColor, setNewUserColor] = useState(AVATAR_COLORS[0]);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleAddUser = async () => {
    if (!newUserName.trim()) return;
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: newUserName.trim(),
          avatar_color: newUserColor,
        }),
      });
      if (res.ok) {
        const user = await res.json();
        await refreshUsers();
        setCurrentUser(user);
        setShowNewUser(false);
        setNewUserName("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-green-800 text-white p-2.5 rounded-xl shadow-lg hover:bg-green-700 transition"
        aria-label="Menu"
      >
        {mobileOpen ? (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
        w-64 bg-gradient-to-b from-green-900 to-green-800 text-white flex flex-col min-h-screen shadow-xl
        fixed lg:relative z-40 transition-transform duration-300 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-green-700 flex flex-col items-center">
          <Image
            src="/logo.png"
            alt="AgroDiary logo"
            width={180}
            height={180}
            className="drop-shadow-lg"
            priority
          />
          <p className="text-green-300 text-sm mt-2">Finca del Imperio</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? "bg-white/20 text-white font-semibold shadow-md"
                        : "text-green-200 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Selector */}
        <div className="p-4 border-t border-green-700 relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition"
          >
            {currentUser ? (
              <>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: currentUser.avatar_color }}
                >
                  {currentUser.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate">
                    {currentUser.nombre}
                  </p>
                  <p className="text-xs text-green-300">{currentUser.rol}</p>
                </div>
                <span className="text-green-300 text-xs">
                  {showUserMenu ? "▲" : "▼"}
                </span>
              </>
            ) : (
              <span className="text-green-300 text-sm">
                Seleccionar usuario...
              </span>
            )}
          </button>

          {/* User dropdown */}
          {showUserMenu && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-xl shadow-2xl overflow-hidden z-50 text-gray-800 max-h-72 overflow-y-auto">
              <div className="p-2 border-b">
                <p className="text-xs font-semibold text-gray-500 px-2 py-1">
                  Cambiar usuario
                </p>
              </div>
              {users.map((user: Usuario) => (
                <button
                  key={user.id}
                  onClick={() => {
                    setCurrentUser(user);
                    setShowUserMenu(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition text-left ${
                    currentUser?.id === user.id ? "bg-green-50" : ""
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: user.avatar_color }}
                  >
                    {user.nombre.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{user.nombre}</span>
                  {currentUser?.id === user.id && (
                    <span className="ml-auto text-green-600 text-xs">✓</span>
                  )}
                </button>
              ))}
              <button
                onClick={() => {
                  setShowNewUser(true);
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition text-left border-t text-blue-600"
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-blue-100 text-blue-600 text-sm font-bold shrink-0">
                  +
                </div>
                <span className="text-sm font-medium">Añadir usuario</span>
              </button>
            </div>
          )}

          {/* New user form */}
          {showNewUser && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-xl shadow-2xl z-50 text-gray-800 p-4">
              <p className="text-sm font-bold mb-3">Nuevo usuario</p>
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Nombre..."
                className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddUser()}
              />
              <div className="flex gap-1.5 mb-3 flex-wrap">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewUserColor(c)}
                    className={`w-7 h-7 rounded-full transition ${
                      newUserColor === c
                        ? "ring-2 ring-offset-1 ring-blue-500 scale-110"
                        : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddUser}
                  className="flex-1 bg-green-600 text-white text-sm py-2 rounded-lg hover:bg-green-700 transition"
                >
                  Crear
                </button>
                <button
                  onClick={() => setShowNewUser(false)}
                  className="px-4 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-green-700">
          <div className="text-green-300 text-xs">
            <p>🌰 Pistachos · 🍇 Viñedo · 🫒 Olivos</p>
            <p className="mt-1 text-green-400">
              v2.0 — {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
