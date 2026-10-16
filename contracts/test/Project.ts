import { expect } from "chai";
import { PRICE, deployScenario, deployWithProjects, ethers, networkHelpers } from "./helpers.js";

async function withFunds() {
  const base = await deployWithProjects();
  const project = await base.projectA.getAddress();
  await base.marketplace.connect(base.investor1).mint(project, { value: PRICE });
  await base.marketplace.connect(base.investor2).mint(project, { value: PRICE });
  return base;
}

describe("Project withdrawals", function () {
  it("lets the creator withdraw part and then the rest, paid to the creator", async function () {
    const { projectA, creatorA } = await networkHelpers.loadFixture(withFunds);
    const half = PRICE;

    await expect(projectA.connect(creatorA).withdraw(half))
      .to.emit(projectA, "Withdrawn")
      .withArgs(creatorA.address, half, half);
    expect(await projectA.availableToWithdraw()).to.equal(PRICE);

    await expect(projectA.connect(creatorA).withdraw(PRICE)).to.changeEtherBalances(
      ethers,
      [projectA, creatorA],
      [-PRICE, PRICE],
    );
    expect(await projectA.totalReceived()).to.equal(2n * PRICE);
    expect(await projectA.totalWithdrawn()).to.equal(2n * PRICE);
    expect(await projectA.availableToWithdraw()).to.equal(0n);
    expect(await ethers.provider.getBalance(await projectA.getAddress())).to.equal(0n);
  });

  it("rejects everyone except the project's creator", async function () {
    const { projectA, creatorB, investor1, organizer } = await networkHelpers.loadFixture(withFunds);
    for (const caller of [creatorB, investor1, organizer]) {
      await expect(projectA.connect(caller).withdraw(PRICE))
        .to.be.revertedWithCustomError(projectA, "NotCreator")
        .withArgs(caller.address);
    }
  });

  it("rejects zero and over-withdrawals", async function () {
    const { projectA, projectB, creatorA, creatorB } = await networkHelpers.loadFixture(withFunds);
    await expect(projectA.connect(creatorA).withdraw(0))
      .to.be.revertedWithCustomError(projectA, "InvalidAmount")
      .withArgs(0n, 2n * PRICE);
    await expect(projectA.connect(creatorA).withdraw(2n * PRICE + 1n)).to.be.revertedWithCustomError(
      projectA,
      "InvalidAmount",
    );
    await projectA.connect(creatorA).withdraw(2n * PRICE);
    await expect(projectA.connect(creatorA).withdraw(1)).to.be.revertedWithCustomError(projectA, "InvalidAmount");
    await expect(projectB.connect(creatorB).withdraw(1)).to.be.revertedWithCustomError(projectB, "InvalidAmount");
  });

  it("ignores ETH that did not arrive through mints", async function () {
    const { projectA, creatorA } = await networkHelpers.loadFixture(withFunds);
    const address = await projectA.getAddress();
    await networkHelpers.setBalance(address, (await ethers.provider.getBalance(address)) + ethers.parseEther("1"));
    expect(await projectA.availableToWithdraw()).to.equal(2n * PRICE);
    await expect(projectA.connect(creatorA).withdraw(2n * PRICE + 1n)).to.be.revertedWithCustomError(
      projectA,
      "InvalidAmount",
    );
  });

  describe("when the creator is a contract", function () {
    async function contractCreator() {
      const base = await deployScenario();
      const creator = await ethers.deployContract("CreatorContractMock");
      await base.factory.setCreatorAllowed(await creator.getAddress(), true);
      await creator.createProject(await base.factory.getAddress(), "Contract project", PRICE);
      const project = await ethers.getContractAt("Project", await creator.project());
      await base.marketplace.connect(base.investor1).mint(await project.getAddress(), { value: PRICE });
      await base.marketplace.connect(base.investor2).mint(await project.getAddress(), { value: PRICE });
      return { ...base, creator, project };
    }

    it("blocks re-entrant withdrawals and keeps the accounting intact", async function () {
      const { creator, project } = await networkHelpers.loadFixture(contractCreator);
      await creator.setMode(2); // Reenter
      await expect(creator.withdraw(PRICE)).to.be.revertedWithCustomError(project, "TransferFailed");
      expect(await project.totalWithdrawn()).to.equal(0n);
      expect(await project.availableToWithdraw()).to.equal(2n * PRICE);
    });

    it("reverts cleanly when the creator rejects ETH", async function () {
      const { creator, project } = await networkHelpers.loadFixture(contractCreator);
      await creator.setMode(1); // Reject
      await expect(creator.withdraw(PRICE)).to.be.revertedWithCustomError(project, "TransferFailed");
      expect(await project.totalWithdrawn()).to.equal(0n);

      await creator.setMode(0); // Accept
      await expect(creator.withdraw(PRICE)).to.changeEtherBalance(ethers, creator, PRICE);
    });
  });
});
