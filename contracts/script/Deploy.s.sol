// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {TanglawVault} from "../src/TanglawVault.sol";

/// @notice Deploys TanglawVault on BSC testnet and seeds the demo settings.
/// Env: DEPLOYER_PRIVATE_KEY, HOSPITAL_ADDRESS, SOCIAL_WORKER_ADDRESS, optional VAULT_FUNDING_WEI.
contract Deploy is Script {
    uint256 constant PESO = 1e11; // demo rate: PHP 1,000,000 = 0.1 tBNB

    function run() external returns (TanglawVault vault) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address hospital = vm.envAddress("HOSPITAL_ADDRESS");
        address socialWorker = vm.envAddress("SOCIAL_WORKER_ADDRESS");
        uint256 funding = vm.envOr("VAULT_FUNDING_WEI", uint256(0.02 ether));
        address deployer = vm.addr(pk);

        require(block.chainid == 97, "Not BSC testnet (chain 97)");

        vm.startBroadcast(pk);
        vault = new TanglawVault(deployer);
        // Simulated program rules (demo settings, not real agency limits)
        vault.setProgram(0, "PhilHealth", 25_000 * PESO, 500_000 * PESO, true);
        vault.setProgram(1, "DOH MAIFIP", 60_000 * PESO, 500_000 * PESO, true);
        vault.setProgram(2, "PCSO IMAP", 20_000 * PESO, 500_000 * PESO, true);
        vault.setHospital(hospital, true);
        vault.setSocialWorker(socialWorker);
        (bool ok,) = payable(address(vault)).call{value: funding}("");
        require(ok, "Funding failed");
        vm.stopBroadcast();

        console2.log("TanglawVault:", address(vault));
        console2.log("Owner (admin):", deployer);
        console2.log("Social worker:", socialWorker);
        console2.log("Hospital:", hospital);
        console2.log("Funded (wei):", funding);
    }
}
