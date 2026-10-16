import { z } from "zod";
import { authErrorResponse, authorize } from "@/lib/auth";
import { TX_KINDS, TxVerificationError, listOwnTxs, verifyAndRecordTx, type TxKind } from "@/lib/tx-verify";

const bodySchema = z.object({
  kind: z.enum(Object.keys(TX_KINDS) as [TxKind, ...TxKind[]]),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash"),
  // Off-chain project description, only used with create_project.
  description: z.string().trim().max(1000).optional(),
});

// Report (or re-check) a transaction. The server reads it from the chain itself; the client's
// view of the status is never trusted.
export async function POST(request: Request) {
  try {
    const user = await authorize(["creator", "investor", "mule"]);
    if (user.kind !== "participant") return Response.json({ error: "Participants only" }, { status: 403 });

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const { kind, txHash, description } = parsed.data;
    return Response.json(await verifyAndRecordTx(user, kind, txHash, { description }));
  } catch (error) {
    if (error instanceof TxVerificationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return authErrorResponse(error);
  }
}

// The participant's own recorded transactions (application records; the chain is the source of truth).
export async function GET() {
  try {
    const user = await authorize(["creator", "investor", "mule"]);
    if (user.kind !== "participant") return Response.json({ error: "Participants only" }, { status: 403 });
    return Response.json(await listOwnTxs(user));
  } catch (error) {
    return authErrorResponse(error);
  }
}
