import { floorApiPath } from "@/lib/hq-connector";
import type { ApprovalDecision, ApprovalRequest } from "@/lib/hq-jobs";
import { useHqStore } from "@/lib/hq-store";

/**
 * Resolves one human-in-the-loop approval. In SIM mode the decision is local;
 * in LIVE mode it's POSTed to the Floor API (which can fan it out to n8n via
 * ON_DECISION_WEBHOOK) and a 404 (already decided upstream) still resolves.
 */
export async function decideApproval(
  a: ApprovalRequest,
  decision: ApprovalDecision,
): Promise<{ ok: boolean; message?: string }> {
  const st = useHqStore.getState();
  const finish = () => st.resolveApproval(a.id, decision, a.title);
  if (st.floorSource === "sim") {
    finish();
    return { ok: true };
  }
  try {
    const res = await fetch(
      floorApiPath(st.connector, `/approvals/${encodeURIComponent(a.id)}/decision`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      },
    );
    if (res.status === 404) {
      finish();
      return { ok: true };
    }
    if (!res.ok) throw new Error(`keputusan gagal (HTTP ${res.status})`);
    finish();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "gagal mengirim keputusan" };
  }
}
