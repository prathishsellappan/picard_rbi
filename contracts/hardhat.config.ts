import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatKeystore from "@nomicfoundation/hardhat-keystore";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatTypechain from "@nomicfoundation/hardhat-typechain";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import { configVariable, defineConfig } from "hardhat/config";

// Only two networks exist here: a local Hardhat node and Sepolia. There is deliberately no
// mainnet entry. Scripts additionally refuse to run on any other chain ID.
export default defineConfig({
  plugins: [
    hardhatEthers,
    hardhatEthersChaiMatchers,
    hardhatKeystore,
    hardhatMocha,
    hardhatNetworkHelpers,
    hardhatTypechain,
    hardhatVerify,
  ],
  solidity: {
    profiles: {
      default: { version: "0.8.34" },
      production: {
        version: "0.8.34",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    },
  },
  networks: {
    localhost: {
      type: "http",
      chainType: "l1",
      chainId: 31337,
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      chainId: 11155111,
      url: configVariable("SEPOLIA_RPC_URL"),
      // signer 0 = organizer deployer, signer 1 = Exchange 1. Stored with `hardhat keystore set`,
      // never in a file in this repository.
      accounts: [configVariable("SEPOLIA_DEPLOYER_PRIVATE_KEY"), configVariable("SEPOLIA_EXCHANGE1_PRIVATE_KEY")],
    },
  },
  verify: {
    etherscan: { apiKey: configVariable("ETHERSCAN_API_KEY") },
  },
});
