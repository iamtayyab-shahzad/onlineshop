import { ActionForm } from "@/components/admin/action-form";
import { setOrderStatus } from "@/app/admin/_actions/orders";

/** One-tap Complete (delivered) and Cancel buttons for an open order. */
export function OrderActionButtons({ id, number }: { id: string; number: number }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <ActionForm action={setOrderStatus} submit="Complete ✓" inline>
        <input type="hidden" name="order_id" value={id} />
        <input type="hidden" name="status" value="delivered" />
      </ActionForm>
      <ActionForm
        action={setOrderStatus}
        submit="Cancel"
        danger
        inline
        confirm={`Cancel order #${number}? Its amount will be taken off the totals.`}
      >
        <input type="hidden" name="order_id" value={id} />
        <input type="hidden" name="status" value="cancelled" />
      </ActionForm>
    </div>
  );
}
