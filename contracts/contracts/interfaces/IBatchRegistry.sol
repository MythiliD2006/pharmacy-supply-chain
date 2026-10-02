

pragma solidity ^0.8.24;

import "./IAccessControlManager.sol";

interface IBatchRegistry {
    function batchExists(string calldata batchId) external view returns (bool);

    function currentHolderOf(string calldata batchId) external view returns (address);

    function isExpired(string calldata batchId) external view returns (bool);

    function recordTransfer(
        string calldata batchId,
        address from,
        address to,
        IAccessControlManager.Role fromRole,
        IAccessControlManager.Role toRole
    ) external;
}