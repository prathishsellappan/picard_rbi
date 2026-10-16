import { expect } from "chai";
import { MAX_PRICE, PRICE, deployWithProjects, ethers, networkHelpers } from "./helpers.js";

describe("Marketplace", function () {
  it("mints the NFT and routes the full payment to the selected project", async function () {
    const { marketplace, nft, projectA, investor1 } = await networkHelpers.loadFixture(deployWithProjects);
    const projectAddress = await projectA.getAddress();

    const tx = marketplace.connect(investor1).mint(projectAddress, { value: PRICE });
    await expect(tx).to.emit(nft, "Transfer").withArgs(ethers.ZeroAddress, investor1.address, 1n);
    await expect(tx).to.emit(projectA, "FundsReceived").withArgs(investor1.address, 1n, PRICE, PRICE);
    await expect(tx).to.emit(marketplace, "PaymentRouted").withArgs(projectAddress, investor1.address, 1n, PRICE);
    await expect(tx).to.changeEtherBalances(ethers, [investor1, projectA, marketplace], [-PRICE, PRICE, 0n]);

    expect(await nft.ownerOf(1)).to.equal(investor1.address);
    expect(await nft.projectOf(1)).to.equal(projectAddress);
    expect(await nft.totalMinted()).to.equal(1n);
    expect(await nft.tokenURI(1)).to.equal("http://localhost:3000/api/nft/1");
    expect(await projectA.totalReceived()).to.equal(PRICE);
  });

  it("credits only the project the investor chose", async function () {
    const { marketplace, projectA, projectB, investor1, investor2 } =
      await networkHelpers.loadFixture(deployWithProjects);
    await marketplace.connect(investor1).mint(await projectB.getAddress(), { value: MAX_PRICE });
    await marketplace.connect(investor2).mint(await projectB.getAddress(), { value: MAX_PRICE });
    await marketplace.connect(investor2).mint(await projectA.getAddress(), { value: PRICE });

    expect(await projectA.totalReceived()).to.equal(PRICE);
    expect(await projectB.totalReceived()).to.equal(2n * MAX_PRICE);
    expect(await ethers.provider.getBalance(await projectB.getAddress())).to.equal(2n * MAX_PRICE);
    expect(await ethers.provider.getBalance(await marketplace.getAddress())).to.equal(0n);
  });

  it("rejects incorrect payments", async function () {
    const { marketplace, projectA, investor1 } = await networkHelpers.loadFixture(deployWithProjects);
    const project = await projectA.getAddress();
    for (const value of [0n, PRICE - 1n, PRICE + 1n]) {
      await expect(marketplace.connect(investor1).mint(project, { value }))
        .to.be.revertedWithCustomError(marketplace, "IncorrectPayment")
        .withArgs(PRICE, value);
    }
  });

  it("rejects projects that the factory did not create", async function () {
    const { marketplace, investor1, outsider } = await networkHelpers.loadFixture(deployWithProjects);

    // An EOA and a look-alike Project deployed outside the factory (even one that names this marketplace).
    const fake = await ethers.deployContract("Project", [
      1n,
      outsider.address,
      await marketplace.getAddress(),
      "Fake",
      PRICE,
      "",
    ]);
    for (const target of [outsider.address, await fake.getAddress()]) {
      await expect(marketplace.connect(investor1).mint(target, { value: PRICE }))
        .to.be.revertedWithCustomError(marketplace, "UnknownProject")
        .withArgs(target);
    }
  });

  it("refuses direct ETH transfers", async function () {
    const { marketplace, projectA, investor1 } = await networkHelpers.loadFixture(deployWithProjects);
    await expect(investor1.sendTransaction({ to: await marketplace.getAddress(), value: PRICE })).to.revert(ethers);
    await expect(investor1.sendTransaction({ to: await projectA.getAddress(), value: PRICE })).to.revert(ethers);
  });

  it("does not let anyone bypass the marketplace", async function () {
    const { nft, projectA, investor1 } = await networkHelpers.loadFixture(deployWithProjects);
    await expect(projectA.connect(investor1).deposit(investor1.address, 1, { value: PRICE }))
      .to.be.revertedWithCustomError(projectA, "NotMarketplace")
      .withArgs(investor1.address);
    await expect(nft.connect(investor1).mint(investor1.address, await projectA.getAddress()))
      .to.be.revertedWithCustomError(nft, "NotMarketplace")
      .withArgs(investor1.address);
  });

  it("lets investors transfer NFTs normally (ERC-721)", async function () {
    const { marketplace, nft, projectA, investor1, investor2 } = await networkHelpers.loadFixture(deployWithProjects);
    await marketplace.connect(investor1).mint(await projectA.getAddress(), { value: PRICE });
    await expect(nft.connect(investor1).transferFrom(investor1.address, investor2.address, 1))
      .to.emit(nft, "Transfer")
      .withArgs(investor1.address, investor2.address, 1n);
    expect(await nft.ownerOf(1)).to.equal(investor2.address);
  });

  it("lets only the NFT owner update the base URI", async function () {
    const { nft, outsider } = await networkHelpers.loadFixture(deployWithProjects);
    await expect(nft.connect(outsider).setBaseURI("x")).to.be.revertedWithCustomError(
      nft,
      "OwnableUnauthorizedAccount",
    );
    await expect(nft.setBaseURI("https://example.test/nft/")).to.emit(nft, "BaseURISet");
  });
});
