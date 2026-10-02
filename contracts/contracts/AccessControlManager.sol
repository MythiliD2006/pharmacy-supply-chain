// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IAccessControlManager.sol";

/// @title AccessControlManager
/// @notice Keeps the list of supply-chain participants and their roles.
///         Only the admin can add, edit or disable participants.
contract AccessControlManager is IAccessControlManager {
    struct Participant {
        string name;
        Role role;
        bool active;
        uint256 registeredAt;
    }

    address public override admin;

    mapping(address => Participant) private participants;
    address[] private participantList;

    event ParticipantAdded(address indexed account, string name, Role role);
    event ParticipantUpdated(address indexed account, string name, Role role);
    event ParticipantStatusChanged(address indexed account, bool active);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    error NotAdmin();
    error ZeroAddress();
    error InvalidRole();
    error AlreadyRegistered();
    error NotRegistered();
    error EmptyName();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function addParticipant(address account, string calldata name, Role role) external onlyAdmin {
        if (account == address(0)) revert ZeroAddress();
        if (role == Role.None) revert InvalidRole();
        if (bytes(name).length == 0) revert EmptyName();
        if (participants[account].registeredAt != 0) revert AlreadyRegistered();

        participants[account] = Participant(name, role, true, block.timestamp);
        participantList.push(account);

        emit ParticipantAdded(account, name, role);
    }

    function updateParticipant(address account, string calldata name, Role role) external onlyAdmin {
        if (participants[account].registeredAt == 0) revert NotRegistered();
        if (role == Role.None) revert InvalidRole();
        if (bytes(name).length == 0) revert EmptyName();

        participants[account].name = name;
        participants[account].role = role;

        emit ParticipantUpdated(account, name, role);
    }

    function setParticipantStatus(address account, bool active) external onlyAdmin {
        if (participants[account].registeredAt == 0) revert NotRegistered();

        participants[account].active = active;

        emit ParticipantStatusChanged(account, active);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    function getParticipant(address account) external view returns (Participant memory) {
        return participants[account];
    }

    function getRole(address account) external view override returns (Role) {
        return participants[account].role;
    }

    function isActive(address account) public view override returns (bool) {
        return participants[account].active;
    }

    function hasActiveRole(address account, Role role) external view override returns (bool) {
        Participant storage p = participants[account];
        return p.active && p.role == role;
    }

    function participantCount() external view returns (uint256) {
        return participantList.length;
    }

    function getAllParticipants() external view returns (address[] memory) {
        return participantList;
    }
}