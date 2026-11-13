// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TanglawVault} from "../src/TanglawVault.sol";

contract TanglawVaultTest is Test {
    // Demo rate: 1 peso = 1e11 wei (PHP 1,000,000 = 0.1 tBNB).
    uint256 constant PESO = 1e11;

    uint8 constant TES = 0;
    uint8 constant CITY = 1;
    uint8 constant ALUMNI = 2;

    TanglawVault vault;
    address admin = makeAddr("admin");
    address officer = makeAddr("officer");
    address school = makeAddr("school");
    address stranger = makeAddr("stranger");

    bytes32 caseId = keccak256("random-case-id");
    bytes32 caseHash = keccak256("salt||record");
    bytes32 planHash = keccak256("plan-json");

    event CaseOpened(bytes32 indexed caseId, address indexed school, uint256 bill);
    event PlanApproved(bytes32 indexed caseId, bytes32 planHash);
    event Paid(
        bytes32 indexed caseId, uint8 indexed programId, address indexed school, uint256 amount, bytes32 planHash
    );

    function setUp() public {
        vault = new TanglawVault(admin);
        vm.startPrank(admin);
        vault.setProgram(TES, "CHED TES", 20_000 * PESO, 500_000 * PESO, true);
        vault.setProgram(CITY, "City Scholarship", 10_000 * PESO, 500_000 * PESO, true);
        vault.setProgram(ALUMNI, "Alumni Grant", 15_000 * PESO, 500_000 * PESO, true);
        vault.setSchool(school, true);
        vault.setOfficer(officer);
        vm.stopPrank();
        vm.deal(address(vault), 1 ether);

        // Maria's assessment: PHP 38,000
        vm.prank(officer);
        vault.openCase(caseId, caseHash, school, 38_000 * PESO);
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

    function _three(uint256 tes, uint256 city, uint256 alumni)
        internal
        pure
        returns (uint8[] memory ids, uint256[] memory amts)
    {
        ids = new uint8[](3);
        amts = new uint256[](3);
        (ids[0], ids[1], ids[2]) = (TES, CITY, ALUMNI);
        (amts[0], amts[1], amts[2]) = (tes * PESO, city * PESO, alumni * PESO);
    }

    function _pay(uint8[] memory ids, uint256[] memory amts) internal {
        vm.prank(officer);
        vault.approveAndPay(caseId, ids, amts, planHash);
    }

    // 1. Valid plan within caps: allowed, school paid, events emitted
    function test_01_ValidPlanPaysSchool() public {
        (uint8[] memory ids, uint256[] memory amts) = _one(TES, 10_000);
        uint256 before = school.balance;

        vm.expectEmit(true, false, false, true, address(vault));
        emit PlanApproved(caseId, planHash);
        vm.expectEmit(true, true, true, true, address(vault));
        emit Paid(caseId, TES, school, 10_000 * PESO, planHash);
        _pay(ids, amts);

        assertEq(school.balance - before, 10_000 * PESO);
        assertEq(vault.remaining(caseId), 28_000 * PESO);
        assertEq(vault.paidByProgram(caseId, TES), 10_000 * PESO);
    }

    // 2. Full demo (Case A): TES 20k + City 10k + Alumni 8k on a 38k assessment
    function test_02_FullDemoReachesZero() public {
        (uint8[] memory ids, uint256[] memory amts) = _three(20_000, 10_000, 8_000);
        uint256 before = school.balance;

        vm.expectEmit(true, true, true, true, address(vault));
        emit Paid(caseId, TES, school, 20_000 * PESO, planHash);
        vm.expectEmit(true, true, true, true, address(vault));
        emit Paid(caseId, CITY, school, 10_000 * PESO, planHash);
        vm.expectEmit(true, true, true, true, address(vault));
        emit Paid(caseId, ALUMNI, school, 8_000 * PESO, planHash);
        _pay(ids, amts);

        assertEq(vault.remaining(caseId), 0);
        assertEq(school.balance - before, 38_000 * PESO);
        assertEq(vault.programRoom(caseId, TES), 0);
        assertEq(vault.programRoom(caseId, ALUMNI), 7_000 * PESO);
    }

    // 3. Line above its per-case cap
    function test_03_RevertOverProgramCap() public {
        (uint8[] memory ids, uint256[] memory amts) = _one(CITY, 10_001);
        vm.expectRevert(TanglawVault.OverProgramCap.selector);
        _pay(ids, amts);
    }

    // 4. Total above the assessment: stacked grants cannot double-fund
    function test_04_RevertOverBill() public {
        // Each line is within its cap, but 20k + 10k + 15k = 45k > 38k assessment
        (uint8[] memory ids, uint256[] memory amts) = _three(20_000, 10_000, 15_000);
        vm.expectRevert(TanglawVault.OverBill.selector);
        _pay(ids, amts);
    }

    // 5. Any other wallet calls approveAndPay or openCase
    function test_05_RevertNotOfficer() public {
        (uint8[] memory ids, uint256[] memory amts) = _one(TES, 1_000);
        vm.prank(stranger);
        vm.expectRevert(TanglawVault.NotOfficer.selector);
        vault.approveAndPay(caseId, ids, amts, planHash);

        vm.prank(admin); // even the owner cannot approve
        vm.expectRevert(TanglawVault.NotOfficer.selector);
        vault.approveAndPay(caseId, ids, amts, planHash);

        vm.prank(stranger);
        vm.expectRevert(TanglawVault.NotOfficer.selector);
        vault.openCase(keccak256("other"), caseHash, school, 1_000 * PESO);
    }

    // 6. Case for a non-allowlisted school (ghost payee)
    function test_06_RevertUnknownSchool() public {
        vm.prank(officer);
        vm.expectRevert(TanglawVault.UnknownSchool.selector);
        vault.openCase(keccak256("other"), caseHash, stranger, 1_000 * PESO);
    }

    // 7. Pay an unknown case
    function test_07_RevertCaseNotFound() public {
        (uint8[] memory ids, uint256[] memory amts) = _one(TES, 1_000);
        vm.prank(officer);
        vm.expectRevert(TanglawVault.CaseNotFound.selector);
        vault.approveAndPay(keccak256("missing"), ids, amts, planHash);
    }

    // 8. Paused, then pay
    function test_08_RevertPaused() public {
        vm.prank(admin);
        vault.setPaused(true);
        (uint8[] memory ids, uint256[] memory amts) = _one(TES, 1_000);
        vm.expectRevert(TanglawVault.Paused.selector);
        _pay(ids, amts);
    }

    // 9. Amount above program budget left
    function test_09_RevertOverBudget() public {
        vm.prank(admin);
        vault.setProgram(ALUMNI, "Alumni Grant", 15_000 * PESO, 5_000 * PESO, true);
        (uint8[] memory ids, uint256[] memory amts) = _one(ALUMNI, 8_000);
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
        (uint8[] memory ids, uint256[] memory amts) = _one(TES, 20_000);
        _pay(ids, amts);
        assertEq(vault.remaining(caseId), 18_000 * PESO);

        (ids, amts) = _two(CITY, 10_000, ALUMNI, 8_000);
        _pay(ids, amts);
        assertEq(vault.remaining(caseId), 0);

        (ids, amts) = _one(ALUMNI, 1);
        vm.expectRevert(TanglawVault.OverBill.selector);
        _pay(ids, amts);
    }

    // 12. Cap is cumulative, across calls and within one call
    function test_12_CapIsCumulative() public {
        (uint8[] memory ids, uint256[] memory amts) = _one(TES, 15_000);
        _pay(ids, amts);

        (ids, amts) = _one(TES, 10_000);
        vm.expectRevert(TanglawVault.OverProgramCap.selector);
        _pay(ids, amts);

        // Same program twice in one call: 5k fits, the next 1k does not
        (ids, amts) = _two(TES, 5_000, TES, 1_000);
        vm.expectRevert(TanglawVault.OverProgramCap.selector);
        _pay(ids, amts);
        assertEq(vault.paidByProgram(caseId, TES), 15_000 * PESO);
    }

    // 13. Check order: PHP 200,000 TES line breaks cap AND assessment -> OverProgramCap
    function test_13_CheckOrderCapBeforeBill() public {
        (uint8[] memory ids, uint256[] memory amts) = _one(TES, 200_000);
        vm.expectRevert(TanglawVault.OverProgramCap.selector);
        _pay(ids, amts);
    }

    // 14. Demo Case B: after the assessment is fully paid, an extra PHP 5,000 alumni
    //     release (still within the alumni cap) is refused as double-funding
    function test_14_DemoCaseBDoubleFundingRefused() public {
        (uint8[] memory ids, uint256[] memory amts) = _three(20_000, 10_000, 8_000);
        _pay(ids, amts);

        (ids, amts) = _one(ALUMNI, 5_000);
        vm.expectRevert(TanglawVault.OverBill.selector);
        _pay(ids, amts);
        assertEq(vault.paidByProgram(caseId, ALUMNI), 8_000 * PESO);
    }
}
