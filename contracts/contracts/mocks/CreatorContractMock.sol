// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Project} from "../Project.sol";
import {ProjectFactory} from "../ProjectFactory.sol";

/// @dev TEST ONLY. A contract acting as a creator, used to check that withdrawals are safe when
///      the creator is malicious code: it either rejects ETH or tries to re-enter withdraw().
contract CreatorContractMock {
    enum Mode {
        Accept,
        Reject,
        Reenter
    }

    Mode public mode;
    Project public project;

    function setMode(Mode mode_) external {
        mode = mode_;
    }

    function createProject(ProjectFactory factory, string calldata name, uint256 mintPrice) external {
        project = Project(factory.createProject(name, mintPrice, ""));
    }

    function withdraw(uint256 amount) external {
        project.withdraw(amount);
    }

    receive() external payable {
        if (mode == Mode.Reject) revert("rejecting ETH");
        if (mode == Mode.Reenter) project.withdraw(msg.value);
    }
}
