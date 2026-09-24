import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPushConfig } from "@/lib/push/config";
import { planSlotNotifications } from "@/lib/push/messages";

/**
 * Sends the notifications planned for a newly posted slot. Runs inside
 * after(), once the poster's response has gone out, so a slow push
 * service never slows down posting. Failures are logged, never thrown:
 * a notification is a courtesy, not part of saving the slot.
 */
export async function notifyAboutNewSlot(input: {
  slotId: string;
  squadId: string;
  boardPath: string;
}): Promise<void> {
  const config = getPushConfig();
  if (!config) return;

  try {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    const admin = createAdminClient(config.serviceRoleKey);

    const [squad, members, slots] = await Promise.all([
      admin.from("squads").select("name").eq("id", input.squadId).single(),
      admin.from("members").select("id, display_name, timezone").eq("squad_id", input.squadId),
      admin
        .from("slots")
        .select("id, member_id, starts_at, ends_at")
        .eq("squad_id", input.squadId)
        .gt("ends_at", new Date().toISOString()),
    ]);
    if (squad.error || members.error || slots.error) {
      throw squad.error ?? members.error ?? slots.error;
    }

    const newSlot = slots.data.find((s) => s.id === input.slotId);
    if (!newSlot) return; // already ended or removed

    const plan = planSlotNotifications({
      squadName: squad.data.name,
      boardUrl: input.boardPath,
      members: members.data,
      newSlot,
      activeSlots: slots.data,
    });
    if (plan.length === 0) return;

    const { data: subscriptions, error } = await admin
      .from("push_subscriptions")
      .select("id, member_id, endpoint, p256dh, auth")
      .in(
        "member_id",
        plan.map((p) => p.memberId),
      );
    if (error) throw error;

    const payloadFor = new Map(plan.map((p) => [p.memberId, JSON.stringify(p.payload)]));
    const gone: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payloadFor.get(sub.member_id)!,
            { TTL: 60 * 60, urgency: "high" },
          );
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // 404/410: the browser dropped this subscription; stop sending to it.
          if (status === 404 || status === 410) gone.push(sub.id);
          else console.error("push: send failed", status, (e as Error).message);
        }
      }),
    );

    if (gone.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", gone);
    }
  } catch (e) {
    console.error("push: notifyAboutNewSlot failed", e);
  }
}
