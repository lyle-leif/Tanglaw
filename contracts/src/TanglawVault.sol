// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TanglawVault
/// @notice Pays a case's hospital from government aid programs, only within each program's
///         per-case cap, its budget and the bill. Only the social worker can open cases and
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
        address hospital;
        uint256 bill;
        uint256 covered;
        bool exists;
    }

    address public socialWorker;
    bool public paused;

    mapping(address => bool) public isHospital;
    mapping(uint8 => Program) public programs;
    mapping(bytes32 => Case) public cases;
    mapping(bytes32 => mapping(uint8 => uint256)) public paidByProgram;

    error NotSocialWorker();
    error OverProgramCap();
    error OverBudget();
    error OverBill();
    error UnknownHospital();
    error CaseNotFound();
    error Paused();
    error InactiveProgram();
    error ZeroAmount();
    error BadArrays();
    error CaseExists();
    error TransferFailed();

    event CaseOpened(bytes32 indexed caseId, address indexed hospital, uint256 bill);
    event PlanApproved(bytes32 indexed caseId, bytes32 planHash);
    event Paid(
        bytes32 indexed caseId, uint8 indexed programId, address indexed hospital, uint256 amount, bytes32 planHash
    );
    event ProgramSet(uint8 indexed id, string name, uint256 perCaseCap, uint256 budget, bool active);
    event HospitalSet(address indexed hospital, bool ok);
    event SocialWorkerSet(address indexed socialWorker);
    event PausedSet(bool paused);

    modifier onlySocialWorker() {
        if (msg.sender != socialWorker) revert NotSocialWorker();
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ---------- Social worker ----------

    /// @notice Opens a case. The bill is entered by the social worker, never by the AI.
    function openCase(bytes32 caseId, bytes32 caseHash, address hospital, uint256 bill) external onlySocialWorker {
        if (paused) revert Paused();
        if (!isHospital[hospital]) revert UnknownHospital();
        if (bill == 0) revert ZeroAmount();
        if (cases[caseId].exists) revert CaseExists();

        cases[caseId] = Case({caseHash: caseHash, hospital: hospital, bill: bill, covered: 0, exists: true});
        emit CaseOpened(caseId, hospital, bill);
    }

    /// @notice Approves a payment plan and pays the case's hospital, line by line.
    /// @dev Check order: paused, case exists, arrays; then per line: active, amount > 0,
    ///      per-case cap, budget, bill. State updates per line, before any transfer.
    function approveAndPay(bytes32 caseId, uint8[] calldata programIds, uint256[] calldata amounts, bytes32 planHash)
        external
        onlySocialWorker
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

        address hospital = c.hospital;
        emit PlanApproved(caseId, planHash);
        for (uint256 i = 0; i < programIds.length; i++) {
            emit Paid(caseId, programIds[i], hospital, amounts[i], planHash);
        }

        (bool ok,) = payable(hospital).call{value: total}("");
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

    function setHospital(address h, bool ok) external onlyOwner {
        isHospital[h] = ok;
        emit HospitalSet(h, ok);
    }

    function setSocialWorker(address sw) external onlyOwner {
        socialWorker = sw;
        emit SocialWorkerSet(sw);
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
