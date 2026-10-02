pragma solidity ^0.8.24;

interface IAccessControlManager {
    enum Role {
        None,
        Manufacturer,
        Distributor,
        Wholesaler,
        Pharmacy
    }

    function admin() external view returns (address);

    function getRole(address account) external view returns (Role);

    function isActive(address account) external view returns (bool);

    function hasActiveRole(address account, Role role) external view returns (bool);
}