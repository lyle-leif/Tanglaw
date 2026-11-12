// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TanglawVault} from "../src/TanglawVault.sol";

contract TanglawVaultTest is Test {
    // Demo rate: 1 peso = 1e11 wei (PHP 1,000,000 = 0.1 tBNB).
    uint256 constant PESO = 1e11;

    uint8 constant PHILHEALTH = 0;
    uint8 constant DOH = 1;
    uint8 constant PCSO = 2;

    TanglawVault vault;
    address admin = makeAddr("admin");
    address liza = makeAddr("socialWorker");
    address hospital = makeAddr("hospital");
    address stranger = makeAddr("stranger");

    bytes32 caseId = keccak256("random-case-id");
    bytes32 caseHash = keccak256("salt||record");
    bytes32 planHash = keccak256("plan-json");

    event CaseOpened(bytes32 indexed caseId, address indexed hospital, uint256 bill);
    event PlanApproved(bytes32 indexed caseId, bytes32 planHash);
    event Paid(
        bytes32 indexed caseId, uint8 indexed programId, address indexed hospital, uint256 amount, bytes32 planHash
    );

    function setUp() public {
        vault = new TanglawVault(admin);
        vm.startPrank(admin);
        vault.setProgram(PHILHEALTH, "PhilHealth", 25_000 * PESO, 500_000 * PESO, true);
        vault.setProgram(DOH, "DOH MAIFIP", 60_000 * PESO, 500_000 * PESO, true);
        vault.setProgram(PCSO, "PCSO IMAP", 20_000 * PESO, 500_000 * PESO, true);
        vault.setHospital(hospital, true);
        vault.setSocialWorker(liza);
        vm.stopPrank();
        vm.deal(address(vault), 1 ether);

        vm.prank(liza);
        vault.openCase(caseId, caseHash, hospital, 80_000 * PESO);
    }

    // ---------- helpers ----------

    function _one(uint8 id, uint256 pesos) internal pure returns (uint8[] memory ids, uint256[] memory amts) {
        ids = new uint8[](1);
        amts = new uint256[](1);
        ids[0] = id;
        amts[0] = pesos * PESO;
    }

    function _two(uint8 a, uint256 pa, uint8 b, uint256 pb)
        internal
        pure
        returns (uint8[] memory ids, uint256[] memory amts)
    {
        ids = new uint8[](2);
        amts = new uint256[](2);
        (ids[0], ids[1]) = (a, b);
        (amts[0], amts[1]) = (pa * PESO, pb * PESO);
    }

    function _pay(uint8[] memory ids, uint256[] memory amts) internal {
        vm.prank(liza);
        vault.approveAndPay(caseId, ids, amts, planHash);
    }

    // 1. Valid plan within caps: allowed, hospital paid, events emitted
    function test_01_ValidPlanPaysHospital() public {
        (uint8[] memory ids, uint256[] memory amts) = _one(PHILHEALTH, 10_000);
        uint256 before = hospital.balance;

        vm.expectEmit(true, false, false, true, address(vault));
        emit PlanApproved(caseId, planHash);
        vm.expectEmit(true, true, true, true, address(vault));
        emit Paid(caseId, PHILHEALTH, hospital, 10_000 * PESO, planHash);
        _pay(ids, amts);

        assertEq(hospital.balance - before, 10_000 * PESO);
        assertEq(vault.remaining(caseId), 70_000 * PESO);
        assertEq(vault.paidByProgram(caseId, PHILHEALTH), 10_000 * PESO);
    }

    // 2. Full demo: PhilHealth 25k + DOH 55k on an 80k bill
    function test_02_FullDemoReachesZero() public {
        (uint8[] memory ids, uint256[] memory amts) = _two(PHILHEALTH, 25_000, DOH, 55_000);
        uint256 before = hospital.balance;

        vm.expectEmit(true, true, true, true, address(vault));
        emit Paid(caseId, PHILHEALTH, hospital, 25_000 * PESO, planHash);
        vm.expectEmit(true, true, true, true, address(vault));
        emit Paid(caseId, DOH, hospital, 55_000 * PESO, planHash);
        _pay(ids, amts);

        assertEq(vault.remaining(caseId), 0);
        assertEq(hospital.balance - before, 80_000 * PESO);
        assertEq(vault.programRoom(caseId, PHILHEALTH), 0);
        assertEq(vault.programRoom(caseId, DOH), 5_000 * PESO);
    }

    // 3. Line above its per-case cap
    function test_03_RevertOverProgramCap() public {
        (uint8[] memory ids, uint256[] memory amts) = _one(PCSO, 20_001);
        vm.expectRevert(TanglawVault.OverProgramCap.selector);
        _pay(ids, amts);
    }

    // 4. Total above the bill
    function test_04_RevertOverBill() public {
        // Each line is within its cap, but 60k + 25k = 85k > 80k bill
        (uint8[] memory ids, uint256[] memory amts) = _two(DOH, 60_000, PHILHEALTH, 25_000);
        vm.expectRevert(TanglawVault.OverBill.selector);
        _pay(ids, amts);
    }

    // 5. Any other wallet calls approveAndPay or openCase
    function test_05_RevertNotSocialWorker() public {
        (uint8[] memory ids, uint256[] memory amts) = _one(PHILHEALTH, 1_000);
        vm.prank(stranger);
        vm.expectRevert(TanglawVault.NotSocialWorker.selector);
        vault.approveAndPay(caseId, ids, amts, planHash);

        vm.prank(admin); // even the owner cannot approve
        vm.expectRevert(TanglawVault.NotSocialWorker.selector);
        vault.approveAndPay(caseId, ids, amts, planHash);

        vm.prank(stranger);
        vm.expectRevert(TanglawVault.NotSocialWorker.selector);
        vault.openCase(keccak256("other"), caseHash, hospital, 1_000 * PESO);
    }

    // 6. Case for a non-allowlisted hospital
    function test_06_RevertUnknownHospital() public {
        vm.prank(liza);
        vm.expectRevert(TanglawVault.UnknownHospital.selector);
        vault.openCase(keccak256("other"), caseHash, stranger, 1_000 * PESO);
    }

    // 7. Pay an unknown case
    function test_07_RevertCaseNotFound() public {
        (uint8[] memory ids, uint256[] memory amts) = _one(PHILHEALTH, 1_000);
        vm.prank(liza);
        vm.expectRevert(TanglawVault.CaseNotFound.selector);
        vault.approveAndPay(keccak256("missing"), ids, amts, planHash);
    }

    // 8. Paused, then pay
    function test_08_RevertPaused() public {
        vm.prank(admin);
        vault.setPaused(true);
        (uint8[] memory ids, uint256[] memory amts) = _one(PHILHEALTH, 1_000);
        vm.expectRevert(TanglawVault.Paused.selector);
        _pay(ids, amts);
    }

    // 9. Amount above program budget left
    function test_09_RevertOverBudget() public {
        vm.prank(admin);
        vault.setProgram(DOH, "DOH MAIFIP", 60_000 * PESO, 30_000 * PESO, true);
        (uint8[] memory ids, uint256[] memory amts) = _one(DOH, 40_000);
        vm.expectRevert(TanglawVault.OverBudget.selector);
        _pay(ids, amts);
    }

    // 10. Mismatched or empty arrays
    function test_10_RevertBadArrays() public {
        uint8[] memory ids = new uint8[](2);
        uint256[] memory amts = new uint256[](1);
        vm.expectRevert(TanglawVault.BadArrays.selector);
        _pay(ids, amts);

        vm.expectRevert(TanglawVault.BadArrays.selector);
        _pay(new uint8[](0), new uint256[](0));
    }

    // 11. Partial payments across two calls, then a third reverts OverBill
    function test_11_PartialPayments() public {
        (uint8[] memory ids, uint256[] memory amts) = _one(PHILHEALTH, 25_000);
        _pay(ids, amts);
        assertEq(vault.remaining(caseId), 55_000 * PESO);

        (ids, amts) = _one(DOH, 55_000);
        _pay(ids, amts);
        assertEq(vault.remaining(caseId), 0);

        (ids, amts) = _one(PCSO, 1);
        vm.expectRevert(TanglawVault.OverBill.selector);
        _pay(ids, amts);
    }

    // 12. Cap is cumulative, across calls and within one call
    function test_12_CapIsCumulative() public {
        (uint8[] memory ids, uint256[] memory amts) = _one(PHILHEALTH, 20_000);
        _pay(ids, amts);

        (ids, amts) = _one(PHILHEALTH, 10_000);
        vm.expectRevert(TanglawVault.OverProgramCap.selector);
        _pay(ids, amts);

        // Same program twice in one call: 5k fits, the next 1k does not
        (ids, amts) = _two(PHILHEALTH, 5_000, PHILHEALTH, 1_000);
        vm.expectRevert(TanglawVault.OverProgramCap.selector);
        _pay(ids, amts);
        assertEq(vault.paidByProgram(caseId, PHILHEALTH), 20_000 * PESO);
    }

    // 13. Check order: PHP 200,000 PhilHealth line breaks cap AND bill -> OverProgramCap
    function test_13_CheckOrderCapBeforeBill() public {
        (uint8[] memory ids, uint256[] memory amts) = _one(PHILHEALTH, 200_000);
        vm.expectRevert(TanglawVault.OverProgramCap.selector);
        _pay(ids, amts);
    }
}
