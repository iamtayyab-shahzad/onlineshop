import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { BlockSkeleton } from "@/components/skeletons";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Sign in" />
      <p className="mb-4 text-base text-muted-foreground">Use the mobile number and password you signed up with.</p>
      <Suspense fallback={<BlockSkeleton />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginForm({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const next = safeNextPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return <AuthForm mode="signin" next={next} />;
}
