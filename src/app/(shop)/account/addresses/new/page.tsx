import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle } from "@/components/page-title";
import { BlockSkeleton } from "@/components/skeletons";
import { requireUser, safeNextPath } from "@/lib/auth";
import { AddressForm } from "../address-form";

export const metadata: Metadata = { title: "Add address" };

export default function NewAddressPage({ searchParams }: PageProps<"/account/addresses/new">) {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Add address" backHref="/account/addresses" backLabel="My addresses" />
      <Suspense fallback={<BlockSkeleton />}>
        <NewAddress searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewAddress({ searchParams }: { searchParams: PageProps<"/account/addresses/new">["searchParams"] }) {
  const next = safeNextPath((await searchParams).next, "/account/addresses");
  const user = await requireUser(`/account/addresses/new?next=${encodeURIComponent(next)}`);
  return <AddressForm next={next} defaults={{ recipient_name: user.fullName, phone: user.phone ?? "" }} />;
}
