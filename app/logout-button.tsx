"use client";

import { signOut } from "next-auth/react";

export function LogoutButton({ className = "button-ghost" }: { className?: string }) {
  return (
    <button className={className} type="button" onClick={() => signOut({ callbackUrl: "/" })}>
      Sign out
    </button>
  );
}
