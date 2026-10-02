const { ethers } = require("ethers");
const { abis } = require("../config/blockchain");

// Turns contract custom errors into messages the frontend can show directly
const MESSAGES = {
  NotAdmin: "Only the admin can do this.",
  ZeroAddress: "Address cannot be empty.",
  InvalidRole: "Invalid role.",
  AlreadyRegistered: "This wallet is already registered as a participant.",
  NotRegistered: "This wallet is not a registered participant.",
  EmptyName: "Name is required.",
  NotManufacturer: "Only an active manufacturer can register batches.",
  NotTransferContract: "Not allowed.",
  TransferContractAlreadySet: "Transfer contract is already linked.",
  BatchAlreadyExists: "A batch with this ID already exists.",
  BatchNotFound: "Batch not found.",
  InvalidBatchData:
    "Invalid batch data. Check the name, quantity, and that the manufacturing date is not in the future and expiry is after it.",
  BatchExpired: "This batch has expired and can't be transferred.",
  NotCurrentHolder: "You are not the current holder of this batch.",
  SenderNotActive: "Your account is disabled.",
  ReceiverNotActive: "The receiver is not an active registered participant.",
  InvalidReceiverRole:
    "Batches can only move forward: Manufacturer → Distributor → Wholesaler → Pharmacy.",
  SelfTransfer: "You can't transfer a batch to yourself.",
  TransferAlreadyPending: "This batch already has a pending transfer.",
  TransferNotFound: "Transfer not found.",
  NotPending: "This transfer is no longer pending.",
  NotReceiver: "Only the receiver can respond to this transfer.",
  NotSender: "Only the sender can cancel this transfer.",
};

// one interface that knows every custom error from all three contracts
const errorInterface = new ethers.Interface(
  [...abis.AccessControlManager, ...abis.BatchRegistry, ...abis.SupplyChainTransfer].filter(
    (f, i, arr) => f.type === "error" && arr.findIndex((g) => g.type === "error" && g.name === f.name) === i
  )
);

class BlockchainError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "BlockchainError";
    this.code = code;
    this.status = status;
  }
}

function findRevertData(err) {
  let e = err;
  for (let i = 0; e && i < 5; i++) {
    if (typeof e.data === "string" && e.data.startsWith("0x") && e.data.length >= 10) return e.data;
    if (e.data && typeof e.data.data === "string") return e.data.data;
    e = e.error || e.info?.error || e.cause;
  }
  return null;
}

/** Convert any ethers / RPC error into a BlockchainError */
function toBlockchainError(err) {
  if (err instanceof BlockchainError) return err;

  let name = err?.revert?.name;
  if (!name) {
    const data = findRevertData(err);
    if (data) {
      try {
        name = errorInterface.parseError(data)?.name;
      } catch (_) {
        /* unknown selector */
      }
    }
  }
  if (name) return new BlockchainError(name, MESSAGES[name] || name, 400);

  if (err?.code === "INSUFFICIENT_FUNDS") {
    return new BlockchainError("InsufficientFunds", "Wallet doesn't have enough ETH for gas.", 400);
  }
  if (err?.code === "NETWORK_ERROR" || err?.code === "ECONNREFUSED" || /ECONNREFUSED/.test(err?.message)) {
    return new BlockchainError("NetworkError", "Can't reach the blockchain node.", 503);
  }
  return new BlockchainError("BlockchainError", err?.shortMessage || err?.message || "Blockchain call failed", 500);
}

module.exports = { BlockchainError, toBlockchainError, MESSAGES };