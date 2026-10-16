// Gas each role-play action uses, measured in the Stage 7 end-to-end run (default build profile,
// rounded up; the optimized production profile uses a little less). Used for budget checks only.
export const GAS = {
  deployAll: 5_700_000n, // 3 contract deployments + 2 setMarketplace calls
  setCreatorAllowed: 50_000n,
  createProject: 860_000n,
  mint: 170_000n,
  withdraw: 60_000n,
  transfer: 21_000n,
};

// Expected gas spend per wallet over the whole role-play.
export const GAS_PER_ROLE = {
  creator: GAS.createProject + 2n * GAS.withdraw + 2n * GAS.transfer,
  investor: 3n * GAS.mint,
  mule: 2n * GAS.transfer,
};

// Budget at this multiple of the current fee, since Sepolia fees can jump during the event.
export const FEE_SAFETY = 3n;
