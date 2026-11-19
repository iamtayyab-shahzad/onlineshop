import { ActionForm } from "@/components/admin/action-form";
import { ADMIN_STATUS_LABEL, NEXT_STATUS } from "@/components/admin/admin-ui";
import { setOrderStatus } from "@/app/admin/_actions/orders";
import type { OrderStatus } from "@/lib/orders";

/** One-tap "move to next step" button for an order. */
export function NextStepButton({ id, status }: { id: string; status: OrderStatus }) {
  const next = NEXT_STATUS[status];
  if (!next) return null;
  return (
    <ActionForm action={setOrderStatus} submit={`Mark ${ADMIN_STATUS_LABEL[next]}`} inline>
      <input type="hidden" name="order_id" value={id} />
      <input type="hidden" name="status" value={next} />
    </ActionForm>
  );
}
