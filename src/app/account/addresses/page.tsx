import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MapPin, Pencil, Plus } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { BlockSkeleton } from "@/components/skeletons";
import { requireUser } from "@/lib/auth";
import { getMyAddresses } from "@/lib/account";
import { formatPkMobile } from "@/lib/phone";
import { deleteAddress, makeDefaultAddress } from "../actions";

export const metadata: Metadata = { title: "My addresses" };

export default function AddressesPage() {
  return (
    <>
      <PageTitle title="My addresses" backHref="/account" backLabel="My account" />
      <Suspense fallback={<BlockSkeleton />}>
        <AddressList />
      </Suspense>
    </>
  );
}

async function AddressList() {
  const user = await requireUser("/account/addresses");
  const addresses = await getMyAddresses(user.id);

  return (
    <div className="flex flex-col gap-3">
      {addresses.length === 0 && (
        <p className="rounded-2xl bg-muted p-6 text-center text-lg">No saved addresses yet.</p>
      )}
      {addresses.map((a) => (
        <div key={a.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <MapPin className="mt-1 size-6 shrink-0 text-primary" />
            <div className="flex-1 text-base">
              <p className="text-lg font-semibold">
                {a.label}
                {a.is_default && (
                  <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-sm font-medium text-primary">
                    Main
                  </span>
                )}
              </p>
              <p>
                {a.recipient_name} · {formatPkMobile(a.phone)}
              </p>
              <p>
                {a.address_line}, {a.area}
              </p>
              {a.landmark && <p className="text-muted-foreground">Near: {a.landmark}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/account/addresses/${a.id}`}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 text-base font-semibold"
            >
              <Pencil className="size-4" /> Edit
            </Link>
            {!a.is_default && (
              <form action={makeDefaultAddress} className="flex-1">
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="h-12 w-full rounded-xl border-2 text-base font-semibold">
                  Make main
                </button>
              </form>
            )}
            <form action={deleteAddress}>
              <input type="hidden" name="id" value={a.id} />
              <button
                type="submit"
                className="h-12 rounded-xl px-4 text-base font-semibold text-destructive"
                aria-label={`Delete ${a.label} address`}
              >
                Delete
              </button>
            </form>
          </div>
        </div>
      ))}
      <Link
        href="/account/addresses/new"
        className="flex h-14 items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground"
      >
        <Plus className="size-5" /> Add new address
      </Link>
    </div>
  );
}
