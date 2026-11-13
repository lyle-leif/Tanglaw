// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TanglawVault
/// @notice Pays a student case's school from scholarship programs, only within each program's
///         per-case cap, its budget and the assessment (bill). Only the scholarship officer can open cases and
///         approve payments. The AI never signs: it only drafts the plan whose hash is stored here.
/// @dev Testnet demo. Amounts are in wei (demo rate: 1 peso = 1e11 wei). No personal data is stored.
contract TanglawVault is Ownable, ReentrancyGuard {
    struct Program {
        string name;
        uint256 perCaseCap;
        uint256 budgetLeft;
        bool active;
    }

    struct Case {
        bytes32 caseHash;
        address school;
        uint256 bill;
        uint256 covered;
        bool exists;
    }

    address public officer;
    bool public paused;

    mapping(address => bool) public isSchool;
    mapping(uint8 => Program) public programs;
    mapping(bytes32 => Case) public cases;
    mapping(bytes32 => mapping(uint8 => uint256)) public paidByProgram;

    error NotOfficer();
    error OverProgramCap();
    error OverBudget();
    error OverBill();
    error UnknownSchool();
    error CaseNotFound();
    error Paused();
    error InactiveProgram();
    error ZeroAmount();
    error BadArrays();
    error CaseExists();
    error TransferFailed();

    event CaseOpened(bytes32 indexed caseId, address indexed school, uint256 bill);
    event PlanApproved(bytes32 indexed caseId, bytes32 planHash);
    event Paid(
        bytes32 indexed caseId, uint8 indexed programId, address indexed school, uint256 amount, bytes32 planHash
    );
    event ProgramSet(uint8 indexed id, string name, uint256 perCaseCap, uint256 budget, bool active);
    event SchoolSet(address indexed school, bool ok);
    event OfficerSet(address indexed officer);
    event PausedSet(bool paused);

    modifier onlyOfficer() {
        if (msg.sender != officer) revert NotOfficer();
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ---------- Scholarship officer ----------

    /// @notice Opens a case. The assessment (bill) is entered by the officer, never by the AI.
    function openCase(bytes32 caseId, bytes32 caseHash, address school, uint256 bill) external onlyOfficer {
        if (paused) revert Paused();
        if (!isSchool[school]) revert UnknownSchool();
        if (bill == 0) revert ZeroAmount();
        if (cases[caseId].exists) revert CaseExists();

        cases[caseId] = Case({caseHash: caseHash, school: school, bill: bill, covered: 0, exists: true});
        emit CaseOpened(caseId, school, bill);
    }

    /// @notice Approves a payment plan and pays the case's school, line by line.
    /// @dev Check order: paused, case exists, arrays; then per line: active, amount > 0,
    ///      per-case cap, budget, bill. State updates per line, before any transfer.
    function approveAndPay(bytes32 caseId, uint8[] calldata programIds, uint256[] calldata amounts, bytes32 planHash)
        external
        onlyOfficer
        nonReentrant
    {
        if (paused) revert Paused();
        Case storage c = cases[caseId];
        if (!c.exists) revert CaseNotFound();
        if (programIds.length == 0 || programIds.length != amounts.length) revert BadArrays();

        uint256 total;
        for (uint256 i = 0; i < programIds.length; i++) {
            uint8 id = programIds[i];
            uint256 amount = amounts[i];
            Program storage p = programs[id];

            if (!p.active) revert InactiveProgram();
            if (amount == 0) revert ZeroAmount();
            if (paidByProgram[caseId][id] + amount > p.perCaseCap) revert OverProgramCap();
            if (amount > p.budgetLeft) revert OverBudget();
            if (c.covered + amount > c.bill) revert OverBill();

            paidByProgram[caseId][id] += amount;
            p.budgetLeft -= amount;
            c.covered += amount;
            total += amount;
        }

        address school = c.school;
        emit PlanApproved(caseId, planHash);
        for (uint256 i = 0; i < programIds.length; i++) {
            emit Paid(caseId, programIds[i], school, amounts[i], planHash);
        }

        (bool ok,) = payable(school).call{value: total}("");
        if (!ok) revert TransferFailed();
    }

    // ---------- Admin (owner) ----------

    function setProgram(uint8 id, string calldata name, uint256 perCaseCap, uint256 budget, bool active)
        external
        onlyOwner
    {
        programs[id] = Program({name: name, perCaseCap: perCaseCap, budgetLeft: budget, active: active});
        emit ProgramSet(id, name, perCaseCap, budget, active);
    }

    function setSchool(address h, bool ok) external onlyOwner {
        isSchool[h] = ok;
        emit SchoolSet(h, ok);
    }

    function setOfficer(address o) external onlyOwner {
        officer = o;
        emit OfficerSet(o);
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedSet(p);
    }

    /// @notice Testnet demo funding only.
    receive() external payable {}

    // ---------- Views ----------

    function remaining(bytes32 caseId) external view returns (uint256) {
        Case storage c = cases[caseId];
        return c.bill - c.covered;
    }

    /// @notice How much a program can still pay on this case: min(cap - paid, budgetLeft).
    function programRoom(bytes32 caseId, uint8 id) external view returns (uint256) {
        Program storage p = programs[id];
        uint256 paid = paidByProgram[caseId][id];
        uint256 capLeft = paid >= p.perCaseCap ? 0 : p.perCaseCap - paid;
        return capLeft < p.budgetLeft ? capLeft : p.budgetLeft;
    }
}
