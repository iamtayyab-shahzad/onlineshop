import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle } from "@/components/page-title";
import { BlockSkeleton } from "@/components/skeletons";
import { requireUser } from "@/lib/auth";
import { formatPkMobile } from "@/lib/phone";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Profile" backHref="/account" backLabel="My account" />
      <Suspense fallback={<BlockSkeleton />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}

async function ProfileContent() {
  const user = await requireUser("/account/profile");
  return (
    <ProfileForm
      fullName={user.fullName}
      phone={user.phone ? formatPkMobile(user.phone) : "—"}
    />
  );
}
