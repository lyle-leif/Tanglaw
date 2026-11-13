// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {TanglawVault} from "../src/TanglawVault.sol";

/// @notice Deploys TanglawVault on BSC testnet and seeds the demo settings.
/// Env: DEPLOYER_PRIVATE_KEY, SCHOOL_ADDRESS, OFFICER_ADDRESS, optional VAULT_FUNDING_WEI.
contract Deploy is Script {
    uint256 constant PESO = 1e11; // demo rate: PHP 1,000,000 = 0.1 tBNB

    function run() external returns (TanglawVault vault) {
        require(block.chainid == 97, "Not BSC testnet (chain 97)");

        uint256 pk = readDeployerKey();
        address school = vm.envAddress("SCHOOL_ADDRESS");
        address officer = vm.envAddress("OFFICER_ADDRESS");
        uint256 funding = vm.envOr("VAULT_FUNDING_WEI", uint256(0.02 ether));
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        vault = new TanglawVault(deployer);
        // Simulated scholarship rules (demo settings, not real agency limits)
        vault.setProgram(0, "CHED TES", 20_000 * PESO, 500_000 * PESO, true);
        vault.setProgram(1, "City Scholarship", 10_000 * PESO, 500_000 * PESO, true);
        vault.setProgram(2, "Alumni Grant", 15_000 * PESO, 500_000 * PESO, true);
        vault.setSchool(school, true);
        vault.setOfficer(officer);
        (bool ok,) = payable(address(vault)).call{value: funding}("");
        require(ok, "Funding failed");
        vm.stopBroadcast();

        console2.log("TanglawVault:", address(vault));
        console2.log("Owner (admin):", deployer);
        console2.log("Scholarship officer:", officer);
        console2.log("School cashier:", school);
        console2.log("Funded (wei):", funding);
    }

    function readDeployerKey() private view returns (uint256 pk) {
        try vm.envBytes32("DEPLOYER_PRIVATE_KEY") returns (bytes32 value) {
            pk = uint256(value);
        } catch {
            revert("Configure DEPLOYER_PRIVATE_KEY in .env");
        }
        require(pk > 0 && pk < SECP256K1_ORDER, "Invalid DEPLOYER_PRIVATE_KEY");
    }
}
