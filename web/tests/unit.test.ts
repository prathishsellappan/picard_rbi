import { describe, expect, it } from "vitest";
import { normalizeAddress, sameAddress } from "@/lib/address";
import { getSupportedChain, parseChainId } from "@/lib/chains";
import { parseEthAmount } from "@/lib/eth";
import { generateCardPassword, hashPassword, verifyPassword } from "@/lib/password";
import { homePathFor, isAllowed, type SessionUser } from "@/lib/roles";
import { briefingFor, economicsFor, profileFor } from "@/scripts/lib/scenario-setup";

describe("chain allowlist", () => {
  it("accepts local and Sepolia", () => {
    expect(parseChainId("31337").name).toBe("Local Hardhat");
    expect(parseChainId("11155111").name).toBe("Sepolia");
  });

  it("rejects Ethereum Mainnet and other networks", () => {
    expect(() => getSupportedChain(1)).toThrow(/Unsupported chain/);
    expect(() => parseChainId("137")).toThrow(/Unsupported chain/);
  });

  it("rejects missing or malformed values", () => {
    expect(() => parseChainId(undefined)).toThrow();
    expect(() => parseChainId("0x7a69")).toThrow();
  });
});

describe("addresses", () => {
  const addr = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  it("checksums valid addresses", () => {
    expect(normalizeAddress(addr.toLowerCase())).toBe(addr);
    expect(normalizeAddress(`  ${addr}  `)).toBe(addr);
  });

  it("rejects bad checksums, junk, and the zero address", () => {
    expect(normalizeAddress(addr.replace("C51812", "c51812"))).toBeNull();
    expect(normalizeAddress("0x1234")).toBeNull();
    expect(normalizeAddress("0x0000000000000000000000000000000000000000")).toBeNull();
  });

  it("compares case-insensitively", () => {
    expect(sameAddress(addr, addr.toLowerCase())).toBe(true);
  });
});

describe("ETH amounts", () => {
  it("parses decimal ETH to wei", () => {
    expect(parseEthAmount("0.01")).toBe(10_000_000_000_000_000n);
    expect(parseEthAmount("1")).toBe(10n ** 18n);
  });

  it("rejects negatives, junk, and too many decimals", () => {
    expect(parseEthAmount("-1")).toBeNull();
    expect(parseEthAmount("abc")).toBeNull();
    expect(parseEthAmount("1e18")).toBeNull();
    expect(parseEthAmount("0.0000000000000000001")).toBeNull();
  });
});

describe("passwords", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("correct horse", "garbage")).toBe(false);
  });

  it("generates card passwords without ambiguous characters", () => {
    const pw = generateCardPassword(40);
    expect(pw).toHaveLength(40);
    expect(pw).not.toMatch(/[0O1lI]/);
  });
});

describe("role rules", () => {
  const investor: SessionUser = {
    kind: "participant",
    scenarioId: 1,
    participantId: "P06",
    username: "investor1",
    displayName: "x",
    role: "investor",
    walletAddress: "0x0",
  };
  const organizer: SessionUser = { kind: "organizer", organizerId: 1, username: "organizer" };

  it("allows only listed roles", () => {
    expect(isAllowed(investor, ["investor"])).toBe(true);
    expect(isAllowed(investor, ["creator", "organizer"])).toBe(false);
    expect(isAllowed(organizer, ["organizer"])).toBe(true);
    expect(isAllowed(null, ["investor"])).toBe(false);
  });

  it("sends each role to its own dashboard", () => {
    expect(homePathFor(investor)).toBe("/investor");
    expect(homePathFor(organizer)).toBe("/organizer");
  });
});

describe("Frosties scenario defaults", () => {
  it("names the 15 participants after the case", () => {
    expect(profileFor(1)).toEqual({
      username: "frosties",
      displayName: "Frosties creator",
      explorerLabel: "Contract creator",
    });
    expect(profileFor(2).username).toBe("creator1");
    expect(profileFor(6)).toEqual({ username: "buyer1", displayName: "Buyer 1", explorerLabel: "Buyer 1" });
    expect(profileFor(14).username).toBe("buyer9");
    expect(profileFor(15)).toEqual({ username: "mule", displayName: "Second wallet", explorerLabel: "" });
  });

  it("uses the real 0.04 ETH price locally and a 10x smaller one on Sepolia", () => {
    expect(economicsFor(31337).frostiesPrice).toBe("0.04");
    expect(economicsFor(11155111).frostiesPrice).toBe("0.004");
    expect(Number(economicsFor(11155111).maxMintPrice)).toBeGreaterThanOrEqual(0.004);
  });

  it("puts the plan and the second wallet's address only in the Frosties creator's briefing", () => {
    const ctx = { frostiesPrice: "0.04", secondWallet: "0xSECOND", mixerLabel: "Tornado Cash (mixer stand-in)" };
    expect(briefingFor("P01", "creator", ctx)).toContain("0xSECOND");
    for (const [id, role] of [
      ["P02", "creator"],
      ["P06", "investor"],
      ["P15", "mule"],
    ] as const) {
      expect(briefingFor(id, role, ctx)).not.toContain("0xSECOND");
    }
  });
});
