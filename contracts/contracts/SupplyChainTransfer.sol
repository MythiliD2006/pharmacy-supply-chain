// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IAccessControlManager.sol";
import "./interfaces/IBatchRegistry.sol";

/// @title SupplyChainTransfer
/// @notice Two-step batch transfers: the holder requests, the receiver confirms or rejects.
///         Batches can only move forward (Manufacturer -> Distributor -> Wholesaler -> Pharmacy).
contract SupplyChainTransfer {
    enum Status {
        Pending,
        Confirmed,
        Rejected,
        Cancelled
    }

    struct Transfer {
        uint256 id;
        string batchId;
        address from;
        address to;
        IAccessControlManager.Role fromRole;
        IAccessControlManager.Role toRole;
        Status status;
        uint256 requestedAt;
        uint256 resolvedAt;
    }

    IAccessControlManager public immutable accessControl;
    IBatchRegistry public immutable registry;

    Transfer[] private transfers;
    mapping(bytes32 => uint256[]) private transfersByBatch;
    mapping(bytes32 => bool) public hasPendingTransfer;
    mapping(address => uint256[]) private incoming;
    mapping(address => uint256[]) private outgoing;

    uint256 public confirmedCount;
    uint256 public rejectedCount;

    event TransferRequested(uint256 indexed transferId, string batchId, address indexed from, address indexed to);
    event TransferConfirmed(uint256 indexed transferId, string batchId, address indexed from, address indexed to);
    event TransferRejected(uint256 indexed transferId, string batchId, address indexed from, address indexed to);
    event TransferCancelled(uint256 indexed transferId, string batchId, address indexed from, address indexed to);

    error ZeroAddress();
    error BatchNotFound();
    error BatchExpired();
    error NotCurrentHolder();
    error SenderNotActive();
    error ReceiverNotActive();
    error InvalidReceiverRole();
    error SelfTransfer();
    error TransferAlreadyPending();
    error TransferNotFound();
    error NotPending();
    error NotReceiver();
    error NotSender();

    constructor(address accessControlAddress, address registryAddress) {
        if (accessControlAddress == address(0) || registryAddress == address(0)) revert ZeroAddress();
        accessControl = IAccessControlManager(accessControlAddress);
        registry = IBatchRegistry(registryAddress);
    }

    function requestTransfer(string calldata batchId, address to) external returns (uint256 transferId) {
        if (to == address(0)) revert ZeroAddress();
        if (to == msg.sender) revert SelfTransfer();
        if (!registry.batchExists(batchId)) revert BatchNotFound();
        if (registry.isExpired(batchId)) revert BatchExpired();
        if (registry.currentHolderOf(batchId) != msg.sender) revert NotCurrentHolder();
        if (!accessControl.isActive(msg.sender)) revert SenderNotActive();
        if (!accessControl.isActive(to)) revert ReceiverNotActive();

        IAccessControlManager.Role fromRole = accessControl.getRole(msg.sender);
        IAccessControlManager.Role toRole = accessControl.getRole(to);
        if (uint8(toRole) <= uint8(fromRole)) revert InvalidReceiverRole();

        bytes32 key = keccak256(bytes(batchId));
        if (hasPendingTransfer[key]) revert TransferAlreadyPending();

        transferId = transfers.length;
        transfers.push(
            Transfer({
                id: transferId,
                batchId: batchId,
                from: msg.sender,
                to: to,
                fromRole: fromRole,
                toRole: toRole,
                status: Status.Pending,
                requestedAt: block.timestamp,
                resolvedAt: 0
            })
        );
        hasPendingTransfer[key] = true;
        transfersByBatch[key].push(transferId);
        incoming[to].push(transferId);
        outgoing[msg.sender].push(transferId);

        emit TransferRequested(transferId, batchId, msg.sender, to);
    }

    function confirmTransfer(uint256 transferId) external {
        Transfer storage t = _pending(transferId);
        if (msg.sender != t.to) revert NotReceiver();
        if (!accessControl.isActive(msg.sender)) revert ReceiverNotActive();
        // holder could not have changed while pending, but re-check to be safe
        if (registry.currentHolderOf(t.batchId) != t.from) revert NotCurrentHolder();

        t.status = Status.Confirmed;
        t.resolvedAt = block.timestamp;
        hasPendingTransfer[keccak256(bytes(t.batchId))] = false;
        confirmedCount++;

        registry.recordTransfer(t.batchId, t.from, t.to, t.fromRole, t.toRole);

        emit TransferConfirmed(transferId, t.batchId, t.from, t.to);
    }

    function rejectTransfer(uint256 transferId) external {
        Transfer storage t = _pending(transferId);
        if (msg.sender != t.to) revert NotReceiver();

        t.status = Status.Rejected;
        t.resolvedAt = block.timestamp;
        hasPendingTransfer[keccak256(bytes(t.batchId))] = false;
        rejectedCount++;

        emit TransferRejected(transferId, t.batchId, t.from, t.to);
    }

    function cancelTransfer(uint256 transferId) external {
        Transfer storage t = _pending(transferId);
        if (msg.sender != t.from) revert NotSender();

        t.status = Status.Cancelled;
        t.resolvedAt = block.timestamp;
        hasPendingTransfer[keccak256(bytes(t.batchId))] = false;

        emit TransferCancelled(transferId, t.batchId, t.from, t.to);
    }

    // ---------- views ----------

    function getTransfer(uint256 transferId) external view returns (Transfer memory) {
        if (transferId >= transfers.length) revert TransferNotFound();
        return transfers[transferId];
    }

    function getBatchTransfers(string calldata batchId) external view returns (uint256[] memory) {
        return transfersByBatch[keccak256(bytes(batchId))];
    }

    function getIncomingTransfers(address account) external view returns (uint256[] memory) {
        return incoming[account];
    }

    function getOutgoingTransfers(address account) external view returns (uint256[] memory) {
        return outgoing[account];
    }

    function transferCount() external view returns (uint256) {
        return transfers.length;
    }

    // ---------- internal ----------

    function _pending(uint256 transferId) internal view returns (Transfer storage t) {
        if (transferId >= transfers.length) revert TransferNotFound();
        t = transfers[transferId];
        if (t.status != Status.Pending) revert NotPending();
    }
}