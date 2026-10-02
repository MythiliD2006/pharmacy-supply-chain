const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { Role, deployFixture } = require("./helpers");

describe("AccessControlManager", function () {
  it("sets the deployer as admin", async function () {
    const { accessControl, admin } = await loadFixture(deployFixture);
    expect(await accessControl.admin()).to.equal(admin.address);
  });

  it("lets the admin add a participant", async function () {
    const { accessControl, outsider } = await loadFixture(deployFixture);

    await expect(accessControl.addParticipant(outsider.address, "New Distributor", Role.Distributor))
      .to.emit(accessControl, "ParticipantAdded")
      .withArgs(outsider.address, "New Distributor", Role.Distributor);

    const p = await accessControl.getParticipant(outsider.address);
    expect(p.name).to.equal("New Distributor");
    expect(p.role).to.equal(Role.Distributor);
    expect(p.active).to.equal(true);
    expect(await accessControl.participantCount()).to.equal(6);
  });

  it("blocks non-admins from managing participants", async function () {
    const { accessControl, manufacturer, outsider } = await loadFixture(deployFixture);

    await expect(
      accessControl.connect(manufacturer).addParticipant(outsider.address, "x", Role.Pharmacy)
    ).to.be.revertedWithCustomError(accessControl, "NotAdmin");

    await expect(
      accessControl.connect(manufacturer).setParticipantStatus(manufacturer.address, false)
    ).to.be.revertedWithCustomError(accessControl, "NotAdmin");
  });

  it("rejects bad participant data", async function () {
    const { accessControl, manufacturer, outsider } = await loadFixture(deployFixture);

    await expect(
      accessControl.addParticipant(outsider.address, "x", Role.None)
    ).to.be.revertedWithCustomError(accessControl, "InvalidRole");

    await expect(
      accessControl.addParticipant(outsider.address, "", Role.Pharmacy)
    ).to.be.revertedWithCustomError(accessControl, "EmptyName");

    await expect(
      accessControl.addParticipant(manufacturer.address, "dup", Role.Pharmacy)
    ).to.be.revertedWithCustomError(accessControl, "AlreadyRegistered");

    await expect(
      accessControl.addParticipant(ethers.ZeroAddress, "zero", Role.Pharmacy)
    ).to.be.revertedWithCustomError(accessControl, "ZeroAddress");
  });

  it("updates a participant's name and role", async function () {
    const { accessControl, wholesaler } = await loadFixture(deployFixture);

    await expect(accessControl.updateParticipant(wholesaler.address, "Kovai Distributors", Role.Distributor))
      .to.emit(accessControl, "ParticipantUpdated");

    expect(await accessControl.getRole(wholesaler.address)).to.equal(Role.Distributor);
  });

  it("can disable and re-enable a participant", async function () {
    const { accessControl, pharmacy } = await loadFixture(deployFixture);

    await accessControl.setParticipantStatus(pharmacy.address, false);
    expect(await accessControl.isActive(pharmacy.address)).to.equal(false);
    expect(await accessControl.hasActiveRole(pharmacy.address, Role.Pharmacy)).to.equal(false);

    await accessControl.setParticipantStatus(pharmacy.address, true);
    expect(await accessControl.hasActiveRole(pharmacy.address, Role.Pharmacy)).to.equal(true);
  });

  it("transfers admin rights", async function () {
    const { accessControl, outsider } = await loadFixture(deployFixture);

    await accessControl.transferAdmin(outsider.address);
    expect(await accessControl.admin()).to.equal(outsider.address);
    await expect(
      accessControl.addParticipant(outsider.address, "x", Role.Pharmacy)
    ).to.be.revertedWithCustomError(accessControl, "NotAdmin");
  });
});