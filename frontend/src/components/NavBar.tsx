"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation"; // Import useRouter
import cn from "classnames";
import { FiMenu, FiX } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter(); // Initialize the router
  const [isOpen, setIsOpen] = useState(false);

  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  // NEW: Handler for the create website button
  const handleCreateWebsiteClick = () => {
    router.push("/createwebsite");
    setIsOpen(false); // Also close mobile menu if open
  };

  const links = [
    { label: "How it works", href: "/how-it-works" },
    { label: "ask us", href: "/ask" },
    { label: "Pricing", href: "/pricing" },
  ];

  return (
    <nav className="bg-white shadow-md relative z-50">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-2xl font-extrabold text-blue-700">
          zygoflow.
        </Link>

        {/* Desktop menu */}
        <ul className="hidden md:flex items-center space-x-8">
          {links.map(({ label, href }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "transition-colors",
                    active
                      ? "text-blue-700 font-semibold"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  {label}
                </Link>
              </li>
            );
          })}

          {!user && (
            <li>
              <Link
                href="/login"
                className={cn(
                  "transition-colors",
                  pathname === "/login"
                    ? "text-blue-700 font-semibold"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                Login
              </Link>
            </li>
          )}

          {user && (
            <>
              {/* UPDATED: Added the "Create Website" button */}
              <li>
                <button
                  onClick={handleCreateWebsiteClick}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Create Website
                </button>
              </li>
              <li>
                <button
                  onClick={handleLogout}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Logout
                </button>
              </li>
            </>
          )}
        </ul>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-2xl text-gray-700"
          onClick={() => setIsOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {isOpen ? <FiX /> : <FiMenu />}
        </button>
      </div>

      {/* Mobile slide-in menu */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-white shadow-lg transform transition-transform md:hidden",
          { "-translate-x-full": !isOpen, "translate-x-0": isOpen }
        )}
      >
        <div className="p-4">
          <ul className="flex flex-col space-y-4">
            {links.map(({ label, href }) => {
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "block transition-colors",
                      active
                        ? "text-blue-700 font-semibold"
                        : "text-gray-600 hover:text-gray-900"
                    )}
                    onClick={() => setIsOpen(false)}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}

            {!user && (
              <li>
                <Link
                  href="/login"
                  className={cn(
                    "block transition-colors",
                    pathname === "/login"
                      ? "text-blue-700 font-semibold"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  Login
                </Link>
              </li>
            )}

            {user && (
              <>
                {/* UPDATED: Added the "Create Website" button for mobile */}
                <li>
                  <button
                    onClick={handleCreateWebsiteClick}
                    className="text-gray-600 hover:text-gray-900 block transition-colors w-full text-left"
                  >
                    Create Website
                  </button>
                </li>
                <li>
                  <button
                    onClick={handleLogout}
                    className="text-gray-600 hover:text-gray-900 block transition-colors w-full text-left"
                  >
                    Logout
                  </button>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
