const { provider, contracts } = require("../config/blockchain");
const { serializeArgs } = require("./blockchain.service");


const WATCHED = [
  {
    source: "AccessControlManager",
    contract: contracts.accessControl,
    events: ["ParticipantAdded", "ParticipantUpdated", "ParticipantStatusChanged", "AdminTransferred"],
  },
  {
    source: "BatchRegistry",
    contract: contracts.registry,
    events: ["BatchRegistered", "CustodyTransferred"],
  },
  {
    source: "SupplyChainTransfer",
    contract: contracts.transfer,
    events: ["TransferRequested", "TransferConfirmed", "TransferRejected", "TransferCancelled"],
  },
];

const blockTimeCache = new Map();
async function blockTimestamp(blockNumber) {
  if (!blockTimeCache.has(blockNumber)) {
    const block = await provider.getBlock(blockNumber);
    blockTimeCache.set(blockNumber, new Date(block.timestamp * 1000).toISOString());
    if (blockTimeCache.size > 1000) blockTimeCache.delete(blockTimeCache.keys().next().value);
  }
  return blockTimeCache.get(blockNumber);
}

async function fetchEvents(fromBlock, toBlock) {
  const results = [];
  for (const { source, contract, events } of WATCHED) {
    for (const name of events) {
      const logs = await contract.queryFilter(contract.filters[name](), fromBlock, toBlock);
      for (const log of logs) {
        results.push({
          source,
          event: name,
          args: serializeArgs(log),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.index,
        });
      }
    }
  }
  results.sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
  for (const e of results) e.timestamp = await blockTimestamp(e.blockNumber);
  return results;
}

function createEventListener({
  onEvent,
  getLastBlock = async () => null,
  saveLastBlock = async () => {},
  startBlock = Number(process.env.START_BLOCK || 0),
  pollIntervalMs = Number(process.env.EVENT_POLL_MS || 4000),
  chunkSize = Number(process.env.LOG_CHUNK_SIZE || 500),
  confirmations = Number(process.env.EVENT_CONFIRMATIONS || 0),
  logger = console,
} = {}) {
  if (typeof onEvent !== "function") throw new Error("createEventListener needs an onEvent function");

  let timer = null;
  let running = false;
  let busy = false;
  let lastBlock = null;

  async function syncOnce() {
    if (busy) return 0;
    busy = true;
    let processed = 0;
    try {
      if (lastBlock === null) {
        const saved = await getLastBlock();
        lastBlock = saved !== null && saved !== undefined ? Number(saved) : startBlock - 1;
      }

      const head = (await provider.getBlockNumber()) - confirmations;

      // chain was reset (e.g. `npx hardhat node` restarted) -> start over
      if (head < lastBlock) {
        logger.warn(`[events] chain head ${head} is behind last synced block ${lastBlock}, resyncing from ${startBlock}`);
        lastBlock = startBlock - 1;
      }

      while (lastBlock < head) {
        const from = lastBlock + 1;
        const to = Math.min(from + chunkSize - 1, head);
        const events = await fetchEvents(from, to);
        for (const e of events) {
          await onEvent(e);
          processed++;
        }
        lastBlock = to;
        await saveLastBlock(lastBlock);
      }
    } catch (err) {
      logger.error("[events] sync failed:", err.shortMessage || err.message);
    } finally {
      busy = false;
    }
    return processed;
  }

  async function tick() {
    await syncOnce();
    if (running) timer = setTimeout(tick, pollIntervalMs);
  }

  return {
    /** catch up on past events, then keep polling */
    async start() {
      if (running) return;
      running = true;
      logger.log(`[events] listening (poll every ${pollIntervalMs}ms)`);
      await tick();
    },
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    /** run a single catch-up pass (handy in scripts/tests) */
    syncOnce,
    get lastBlock() {
      return lastBlock;
    },
  };
}

module.exports = { createEventListener, fetchEvents };