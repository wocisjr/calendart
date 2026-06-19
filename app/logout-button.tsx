"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export function LogoutButton({ className = "button-ghost" }: { className?: string }) {
  const router = useRouter();

  return (
    <button
      className={className}
      type="button"
      onClick={async () => {
        await signOut({ redirect: false });
        router.push("/");
        router.refresh();
      }}
    >
      Odhlásit se
    </button>
  );
}
