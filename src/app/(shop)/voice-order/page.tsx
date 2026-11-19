import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle } from "@/components/page-title";
import { BlockSkeleton } from "@/components/skeletons";
import { requireUser } from "@/lib/auth";
import { getMyAddresses } from "@/lib/account";
import { VoiceRecorder } from "./voice-recorder";

export const metadata: Metadata = { title: "Order by voice" };

export default function VoiceOrderPage() {
  return (
    <>
      <PageTitle title="Order by voice" backHref="/" backLabel="Home" />
      <p className="mb-4 text-base text-muted-foreground">
        Just say what you need, for example: “2 kg potatoes, 1 dozen eggs, 1 packet milk”. We will call you to confirm.
      </p>
      <Suspense fallback={<BlockSkeleton />}>
        <Recorder />
      </Suspense>
    </>
  );
}

async function Recorder() {
  const user = await requireUser("/voice-order");
  const addresses = await getMyAddresses(user.id);
  return (
    <VoiceRecorder
      userId={user.id}
      addresses={addresses.map((a) => ({
        id: a.id,
        label: a.label,
        area: a.area,
        address_line: a.address_line,
        is_default: a.is_default,
      }))}
    />
  );
}
