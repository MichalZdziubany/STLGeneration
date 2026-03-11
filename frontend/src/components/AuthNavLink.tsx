"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

type AuthNavLinkProps = {
  className?: string;
};

export default function AuthNavLink({ className }: AuthNavLinkProps) {
  const { user } = useAuth();

  const label = user?.email ?? "Log In / Sign In";
  const href = user ? "/profile" : "/login";

  return (
    <Link href={href} className={className} title={label}>
      {label}
    </Link>
  );
}
