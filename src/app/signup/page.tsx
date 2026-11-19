import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { BlockSkeleton } from "@/components/skeletons";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { AuthForm } from "../login/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Create account" />
      <p className="mb-4 text-base text-muted-foreground">
        One-time step. Next time you only need your number and password.
      </p>
      <Suspense fallback={<BlockSkeleton />}>
        <SignupForm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SignupForm({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const next = safeNextPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return <AuthForm mode="signup" next={next} />;
}
