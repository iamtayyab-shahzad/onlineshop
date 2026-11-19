import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BlockSkeleton } from "@/components/skeletons";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/auth-actions";
import { AuthForm } from "@/app/(shop)/login/auth-form";

export const metadata: Metadata = { title: "Admin sign in" };

export default function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-1 text-2xl font-bold">Shop admin</h1>
      <p className="mb-4 text-muted-foreground">Sign in with the admin mobile number and password.</p>
      <Suspense fallback={<BlockSkeleton />}>
        <Login />
      </Suspense>
    </div>
  );
}

async function Login() {
  const user = await getCurrentUser();
  if (user?.isAdmin) redirect("/admin/dashboard");
  if (user) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <p className="font-semibold">This account is not an admin.</p>
        <p className="text-sm text-muted-foreground">
          Admin access is given only from the database (see README → First admin account). Sign out and use the admin
          account.
        </p>
        <form action={signOut}>
          <button type="submit" className="h-10 rounded-lg border-2 px-4 font-semibold">
            Sign out
          </button>
        </form>
      </div>
    );
  }
  return <AuthForm mode="signin" next="/admin/dashboard" adminOnly />;
}
