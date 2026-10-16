import { expect } from "chai";
import { MAX_PRICE, MIN_PRICE, PRICE, deployScenario, ethers, networkHelpers } from "./helpers.js";

describe("ProjectFactory", function () {
  describe("wiring", function () {
    it("sets the marketplace once, owner only", async function () {
      const { factory, nft, outsider } = await networkHelpers.loadFixture(deployScenario);
      await expect(factory.setMarketplace(outsider.address)).to.be.revertedWithCustomError(
        factory,
        "MarketplaceAlreadySet",
      );
      await expect(nft.setMarketplace(outsider.address)).to.be.revertedWithCustomError(nft, "MarketplaceAlreadySet");

      const fresh = await ethers.deployContract("ProjectFactory", [outsider.address, MIN_PRICE, MAX_PRICE]);
      await expect(fresh.setMarketplace(outsider.address))
        .to.be.revertedWithCustomError(fresh, "OwnableUnauthorizedAccount")
        .withArgs((await ethers.getSigners())[0].address);
      await expect(fresh.connect(outsider).setMarketplace(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        fresh,
        "ZeroAddress",
      );
    });

    it("rejects invalid mint price bounds", async function () {
      const [owner] = await ethers.getSigners();
      const factory = await ethers.getContractFactory("ProjectFactory");
      await expect(factory.deploy(owner.address, 0, MAX_PRICE)).to.be.revertedWithCustomError(
        factory,
        "InvalidPriceBounds",
      );
      await expect(factory.deploy(owner.address, MAX_PRICE, MIN_PRICE)).to.be.revertedWithCustomError(
        factory,
        "InvalidPriceBounds",
      );
    });

    it("refuses to create projects before the marketplace is set", async function () {
      const [owner, creator] = await ethers.getSigners();
      const factory = await ethers.deployContract("ProjectFactory", [owner.address, MIN_PRICE, MAX_PRICE]);
      await factory.setCreatorAllowed(creator.address, true);
      await expect(factory.connect(creator).createProject("X", PRICE, "")).to.be.revertedWithCustomError(
        factory,
        "MarketplaceNotSet",
      );
    });
  });

  describe("creator allowlist", function () {
    it("only the owner can allow creators or change bounds", async function () {
      const { factory, outsider } = await networkHelpers.loadFixture(deployScenario);
      await expect(factory.connect(outsider).setCreatorAllowed(outsider.address, true)).to.be.revertedWithCustomError(
        factory,
        "OwnableUnauthorizedAccount",
      );
      await expect(factory.connect(outsider).setMintPriceBounds(1, 2)).to.be.revertedWithCustomError(
        factory,
        "OwnableUnauthorizedAccount",
      );
    });

    it("emits CreatorAllowed", async function () {
      const { factory, outsider } = await networkHelpers.loadFixture(deployScenario);
      await expect(factory.setCreatorAllowed(outsider.address, true))
        .to.emit(factory, "CreatorAllowed")
        .withArgs(outsider.address, true);
    });

    it("blocks creators who are not (or no longer) allowed", async function () {
      const { factory, creatorA, outsider } = await networkHelpers.loadFixture(deployScenario);
      await expect(factory.connect(outsider).createProject("X", PRICE, ""))
        .to.be.revertedWithCustomError(factory, "CreatorNotAllowed")
        .withArgs(outsider.address);

      await factory.setCreatorAllowed(creatorA.address, false);
      await expect(factory.connect(creatorA).createProject("X", PRICE, "")).to.be.revertedWithCustomError(
        factory,
        "CreatorNotAllowed",
      );
    });
  });

  describe("createProject", function () {
    it("deploys a standardized Project owned by the calling creator", async function () {
      const { factory, marketplace, creatorA } = await networkHelpers.loadFixture(deployScenario);
      const predicted = ethers.getCreateAddress({
        from: await factory.getAddress(),
        nonce: await ethers.provider.getTransactionCount(await factory.getAddress()),
      });

      await expect(factory.connect(creatorA).createProject("Aurora Pixels", PRICE, "ipfs://meta"))
        .to.emit(factory, "ProjectCreated")
        .withArgs(1n, predicted, creatorA.address, "Aurora Pixels", PRICE, "ipfs://meta");

      const project = await ethers.getContractAt("Project", predicted);
      expect(await project.projectId()).to.equal(1n);
      expect(await project.creator()).to.equal(creatorA.address);
      expect(await project.factory()).to.equal(await factory.getAddress());
      expect(await project.marketplace()).to.equal(await marketplace.getAddress());
      expect(await project.mintPrice()).to.equal(PRICE);
      expect(await project.name()).to.equal("Aurora Pixels");
      expect(await project.metadataURI()).to.equal("ipfs://meta");
      expect(await project.totalReceived()).to.equal(0n);

      expect(await factory.isProject(predicted)).to.equal(true);
      expect(await factory.projectOfCreator(creatorA.address)).to.equal(predicted);
      expect(await factory.projectCount()).to.equal(1n);
      expect(await factory.projectById(1)).to.equal(predicted);
      expect(await factory.getProjects()).to.deep.equal([predicted]);
    });

    it("allows only one project per creator", async function () {
      const { factory, creatorA } = await networkHelpers.loadFixture(deployScenario);
      await factory.connect(creatorA).createProject("First", PRICE, "");
      await expect(factory.connect(creatorA).createProject("Second", PRICE, "")).to.be.revertedWithCustomError(
        factory,
        "CreatorAlreadyHasProject",
      );
    });

    it("enforces mint price bounds, inclusive", async function () {
      const { factory, creatorA, creatorB, outsider } = await networkHelpers.loadFixture(deployScenario);
      await expect(factory.connect(creatorA).createProject("Low", MIN_PRICE - 1n, ""))
        .to.be.revertedWithCustomError(factory, "MintPriceOutOfBounds")
        .withArgs(MIN_PRICE - 1n, MIN_PRICE, MAX_PRICE);
      await expect(factory.connect(creatorA).createProject("High", MAX_PRICE + 1n, "")).to.be.revertedWithCustomError(
        factory,
        "MintPriceOutOfBounds",
      );
      await factory.connect(creatorA).createProject("Min", MIN_PRICE, "");
      await factory.connect(creatorB).createProject("Max", MAX_PRICE, "");

      await factory.setMintPriceBounds(PRICE, PRICE);
      await factory.setCreatorAllowed(outsider.address, true);
      await expect(factory.connect(outsider).createProject("Old min", MIN_PRICE, "")).to.be.revertedWithCustomError(
        factory,
        "MintPriceOutOfBounds",
      );
    });

    it("validates name and metadata URI length", async function () {
      const { factory, creatorA } = await networkHelpers.loadFixture(deployScenario);
      await expect(factory.connect(creatorA).createProject("", PRICE, "")).to.be.revertedWithCustomError(
        factory,
        "InvalidName",
      );
      await expect(factory.connect(creatorA).createProject("x".repeat(65), PRICE, "")).to.be.revertedWithCustomError(
        factory,
        "InvalidName",
      );
      await expect(factory.connect(creatorA).createProject("ok", PRICE, "u".repeat(257))).to.be.revertedWithCustomError(
        factory,
        "InvalidMetadataURI",
      );
      await factory.connect(creatorA).createProject("x".repeat(64), PRICE, "u".repeat(256));
    });
  });
});
