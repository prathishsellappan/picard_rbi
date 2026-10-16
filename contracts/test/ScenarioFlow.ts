import { expect } from "chai";
import { PRICE, deployWithProjects, ethers, networkHelpers } from "./helpers.js";

// Compact version of the role-play money trail. Stage 7 runs the full 17-wallet simulation.
describe("Scenario money trail", function () {
  it("is fully reconstructable from transactions and events", async function () {
    const { factory, marketplace, projectA, creatorA, investor1, investor2, mule, exchange1, exchange2 } =
      await networkHelpers.loadFixture(deployWithProjects);
    const start = await ethers.provider.getBlockNumber();
    const gasMoney = ethers.parseEther("0.05");

    // Exchange 1 funds the investors.
    await exchange1.sendTransaction({ to: investor1.address, value: gasMoney });
    await exchange1.sendTransaction({ to: investor2.address, value: gasMoney });

    // Investors mint from creator A's project.
    await marketplace.connect(investor1).mint(await projectA.getAddress(), { value: PRICE });
    await marketplace.connect(investor2).mint(await projectA.getAddress(), { value: PRICE });

    // Creator A withdraws everything and forwards it to the mule, who forwards it to Exchange 2.
    const total = await projectA.availableToWithdraw();
    await projectA.connect(creatorA).withdraw(total);
    await creatorA.sendTransaction({ to: mule.address, value: total });
    const exchange2Before = await ethers.provider.getBalance(exchange2.address);
    await mule.sendTransaction({ to: exchange2.address, value: total });

    // Reconstruct from logs alone.
    const created = await factory.queryFilter(factory.filters.ProjectCreated(), 0);
    const routed = await marketplace.queryFilter(marketplace.filters.PaymentRouted(), start);
    const received = await projectA.queryFilter(projectA.filters.FundsReceived(), start);
    const withdrawn = await projectA.queryFilter(projectA.filters.Withdrawn(), start);

    const projectOfA = created.find((e) => e.args.creator === creatorA.address)!.args.project;
    expect(projectOfA).to.equal(await projectA.getAddress());
    expect(routed.map((e) => e.args.investor)).to.deep.equal([investor1.address, investor2.address]);
    expect(routed.every((e) => e.args.project === projectOfA)).to.equal(true);
    expect(received.reduce((s, e) => s + e.args.amount, 0n)).to.equal(2n * PRICE);
    expect(withdrawn).to.have.length(1);
    expect(withdrawn[0].args.to).to.equal(creatorA.address);
    expect(withdrawn[0].args.amount).to.equal(2n * PRICE);

    expect((await ethers.provider.getBalance(exchange2.address)) - exchange2Before).to.equal(2n * PRICE);
  });
});
