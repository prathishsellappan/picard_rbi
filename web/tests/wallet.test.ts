import { describe, expect, it } from "vitest";
import { evaluateWallet, parseChainIdHex, toChainIdHex } from "@/lib/wallet/state";
import { classifyTxError } from "@/lib/wallet/tx-errors";

const ASSIGNED = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const OTHER = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

describe("wallet state", () => {
  it("requires MetaMask", () => {
    expect(evaluateWallet({ hasProvider: false, accounts: [], chainId: null }, ASSIGNED, 31337)).toBe("no-wallet");
  });

  it("asks to connect when no account is connected", () => {
    expect(evaluateWallet({ hasProvider: true, accounts: [], chainId: 31337 }, ASSIGNED, 31337)).toBe("disconnected");
  });

  it("rejects a wallet that is not the assigned one", () => {
    expect(evaluateWallet({ hasProvider: true, accounts: [OTHER], chainId: 31337 }, ASSIGNED, 31337)).toBe(
      "wrong-account",
    );
  });

  it("re-evaluates when MetaMask switches account", () => {
    const before = { hasProvider: true, accounts: [ASSIGNED], chainId: 31337 };
    expect(evaluateWallet(before, ASSIGNED, 31337)).toBe("ready");
    expect(evaluateWallet({ ...before, accounts: [OTHER, ASSIGNED] }, ASSIGNED, 31337)).toBe("wrong-account");
  });

  it("matches addresses case-insensitively (MetaMask reports lowercase)", () => {
    expect(
      evaluateWallet({ hasProvider: true, accounts: [ASSIGNED.toLowerCase()], chainId: 31337 }, ASSIGNED, 31337),
    ).toBe("ready");
  });

  it("rejects the wrong network, including mainnet", () => {
    for (const chainId of [1, 11155111, null]) {
      expect(evaluateWallet({ hasProvider: true, accounts: [ASSIGNED], chainId }, ASSIGNED, 31337)).toBe(
        "wrong-network",
      );
    }
  });

  it("parses MetaMask hex chain IDs", () => {
    expect(parseChainIdHex("0x7a69")).toBe(31337);
    expect(parseChainIdHex("0xaa36a7")).toBe(11155111);
    expect(parseChainIdHex("31337")).toBeNull();
    expect(parseChainIdHex(undefined)).toBeNull();
    expect(toChainIdHex(11155111)).toBe("0xaa36a7");
  });
});

describe("transaction error classification", () => {
  it("detects rejection in MetaMask", () => {
    expect(classifyTxError({ code: "ACTION_REJECTED" }).kind).toBe("rejected");
    expect(classifyTxError({ code: 4001 }).kind).toBe("rejected");
    expect(classifyTxError({ code: "UNKNOWN_ERROR", error: { code: 4001 } }).kind).toBe("rejected");
  });

  it("detects on-chain failure, timeouts, and missing funds", () => {
    expect(classifyTxError({ code: "CALL_EXCEPTION" }).kind).toBe("failed");
    expect(classifyTxError({ code: "TIMEOUT" }).kind).toBe("timeout");
    expect(classifyTxError({ code: "INSUFFICIENT_FUNDS" }).message).toMatch(/Not enough test ETH/);
  });

  it("falls back to the error message", () => {
    expect(classifyTxError(new Error("boom"))).toEqual({ kind: "error", message: "boom" });
    expect(classifyTxError(undefined).kind).toBe("error");
  });
});
