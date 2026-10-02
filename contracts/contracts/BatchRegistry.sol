// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IAccessControlManager.sol";
import "./interfaces/IBatchRegistry.sol";

/// @title BatchRegistry
/// @notice Stores medicine batches and their custody history.
///         Batches are registered by manufacturers. The current holder can only
///         be changed by the SupplyChainTransfer contract after a confirmed transfer.
contract BatchRegistry is IBatchRegistry {
    struct Batch {
        string batchId;
        string medicineName;
        address manufacturer;
        uint256 manufacturingDate;
        uint256 expiryDate;
        uint256 quantity;
        bytes32 dataHash; // hash of the off-chain record, lets the backend detect tampering in the DB
        address currentHolder;
        uint256 registeredAt;
    }

    struct CustodyRecord {
        address from;
        address to;
        IAccessControlManager.Role fromRole;
        IAccessControlManager.Role toRole;
        uint256 timestamp;
    }

    struct VerificationResult {
        bool registered;
        bool expired;
        bool historyValid;
        address currentHolder;
        IAccessControlManager.Role currentHolderRole;
        uint256 transferCount;
    }

    IAccessControlManager public immutable accessControl;
    address public transferContract;

    mapping(bytes32 => Batch) private batches;
    mapping(bytes32 => CustodyRecord[]) private custody;
    string[] private batchIds;

    event BatchRegistered(
        string batchId,
        bytes32 indexed batchKey,
        address indexed manufacturer,
        string medicineName,
        uint256 expiryDate,
        uint256 quantity
    );
    event CustodyTransferred(string batchId, bytes32 indexed batchKey, address indexed from, address indexed to);
    event TransferContractSet(address transferContract);

    error NotAdmin();
    error NotManufacturer();
    error NotTransferContract();
    error TransferContractAlreadySet();
    error BatchAlreadyExists();
    error BatchNotFound();
    error InvalidBatchData();
    error ZeroAddress();

    constructor(address accessControlAddress) {
        if (accessControlAddress == address(0)) revert ZeroAddress();
        accessControl = IAccessControlManager(accessControlAddress);
    }

    /// @notice One-time link to the transfer contract, done right after deployment.
    function setTransferContract(address transferContractAddress) external {
        if (msg.sender != accessControl.admin()) revert NotAdmin();
        if (transferContract != address(0)) revert TransferContractAlreadySet();
        if (transferContractAddress == address(0)) revert ZeroAddress();
        transferContract = transferContractAddress;
        emit TransferContractSet(transferContractAddress);
    }

    function registerBatch(
        string calldata batchId,
        string calldata medicineName,
        uint256 manufacturingDate,
        uint256 expiryDate,
        uint256 quantity,
        bytes32 dataHash
    ) external {
        if (!accessControl.hasActiveRole(msg.sender, IAccessControlManager.Role.Manufacturer)) {
            revert NotManufacturer();
        }
        if (
            bytes(batchId).length == 0 ||
            bytes(medicineName).length == 0 ||
            quantity == 0 ||
            manufacturingDate == 0 ||
            manufacturingDate > block.timestamp ||
            expiryDate <= manufacturingDate
        ) revert InvalidBatchData();

        bytes32 key = _key(batchId);
        if (batches[key].registeredAt != 0) revert BatchAlreadyExists();

        batches[key] = Batch({
            batchId: batchId,
            medicineName: medicineName,
            manufacturer: msg.sender,
            manufacturingDate: manufacturingDate,
            expiryDate: expiryDate,
            quantity: quantity,
            dataHash: dataHash,
            currentHolder: msg.sender,
            registeredAt: block.timestamp
        });
        batchIds.push(batchId);

        emit BatchRegistered(batchId, key, msg.sender, medicineName, expiryDate, quantity);
    }

    /// @dev Called only by SupplyChainTransfer once the receiver confirms.
    function recordTransfer(
        string calldata batchId,
        address from,
        address to,
        IAccessControlManager.Role fromRole,
        IAccessControlManager.Role toRole
    ) external override {
        if (msg.sender != transferContract) revert NotTransferContract();
        bytes32 key = _key(batchId);
        if (batches[key].registeredAt == 0) revert BatchNotFound();

        batches[key].currentHolder = to;
        custody[key].push(CustodyRecord(from, to, fromRole, toRole, block.timestamp));

        emit CustodyTransferred(batchId, key, from, to);
    }

    // ---------- views ----------

    function batchExists(string calldata batchId) public view override returns (bool) {
        return batches[_key(batchId)].registeredAt != 0;
    }

    function getBatch(string calldata batchId) external view returns (Batch memory) {
        bytes32 key = _key(batchId);
        if (batches[key].registeredAt == 0) revert BatchNotFound();
        return batches[key];
    }

    function getCustodyHistory(string calldata batchId) external view returns (CustodyRecord[] memory) {
        return custody[_key(batchId)];
    }

    function currentHolderOf(string calldata batchId) external view override returns (address) {
        return batches[_key(batchId)].currentHolder;
    }

    function isExpired(string calldata batchId) public view override returns (bool) {
        Batch storage b = batches[_key(batchId)];
        return b.registeredAt != 0 && block.timestamp > b.expiryDate;
    }

    /// @notice Everything the customer verification page needs in one call.
    function verifyBatch(string calldata batchId) external view returns (VerificationResult memory result) {
        bytes32 key = _key(batchId);
        Batch storage b = batches[key];
        if (b.registeredAt == 0) return result; // all false = unregistered

        CustodyRecord[] storage log = custody[key];

        result.registered = true;
        result.expired = block.timestamp > b.expiryDate;
        result.historyValid = _historyValid(b.manufacturer, log);
        result.currentHolder = b.currentHolder;
        result.currentHolderRole = log.length == 0
            ? IAccessControlManager.Role.Manufacturer
            : log[log.length - 1].toRole;
        result.transferCount = log.length;
    }

    /// @notice Checks the dataHash stored on-chain against one computed from the DB record.
    function verifyDataHash(string calldata batchId, bytes32 dataHash) external view returns (bool) {
        Batch storage b = batches[_key(batchId)];
        return b.registeredAt != 0 && b.dataHash == dataHash;
    }

    function batchCount() external view returns (uint256) {
        return batchIds.length;
    }

    function getBatchIds(uint256 offset, uint256 limit) external view returns (string[] memory page) {
        uint256 total = batchIds.length;
        if (offset >= total) return new string[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        page = new string[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = batchIds[i];
        }
    }

    // ---------- internal ----------

    /// @dev History is valid when it starts at the manufacturer, every hop continues
    ///      from the previous receiver, and roles only move forward down the chain.
    function _historyValid(address manufacturer, CustodyRecord[] storage log) internal view returns (bool) {
        address expectedFrom = manufacturer;
        IAccessControlManager.Role lastRole = IAccessControlManager.Role.Manufacturer;

        for (uint256 i = 0; i < log.length; i++) {
            CustodyRecord storage r = log[i];
            if (r.from != expectedFrom) return false;
            if (r.fromRole != lastRole) return false;
            if (uint8(r.toRole) <= uint8(r.fromRole)) return false;
            expectedFrom = r.to;
            lastRole = r.toRole;
        }
        return true;
    }

    function _key(string calldata batchId) internal pure returns (bytes32) {
        return keccak256(bytes(batchId));
    }
}