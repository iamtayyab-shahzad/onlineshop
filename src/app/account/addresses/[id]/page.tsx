import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { BlockSkeleton } from "@/components/skeletons";
import { requireUser } from "@/lib/auth";
import { getMyAddress } from "@/lib/account";
import { AddressForm } from "../address-form";

export const metadata: Metadata = { title: "Edit address" };

export default function EditAddressPage({ params }: PageProps<"/account/addresses/[id]">) {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Edit address" backHref="/account/addresses" backLabel="My addresses" />
      <Suspense fallback={<BlockSkeleton />}>
        <EditAddress params={params} />
      </Suspense>
    </div>
  );
}

async function EditAddress({ params }: { params: PageProps<"/account/addresses/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/account/addresses/${encodeURIComponent(id)}`);
  const address = await getMyAddress(user.id, id);
  if (!address) notFound();
  return (
    <AddressForm
      address={address}
      next="/account/addresses"
      defaults={{ recipient_name: user.fullName, phone: user.phone ?? "" }}
    />
  );
}
