// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AlgoArena {
    // This structure holds the details of a completed battle
    struct Battle {
        string winner;
        string loser;
        uint256 timestamp;
    }

    // An array to store all battles that have ever happened
    Battle[] public battles;

    // An event that gets broadcasted to the network whenever a battle is recorded
    event BattleRecorded(string winner, string loser, uint256 timestamp);

    // Function to save a new battle result to the blockchain
    function recordBattle(string memory _winner, string memory _loser) public {
        battles.push(Battle(_winner, _loser, block.timestamp));
        
        // Emit the event so our Node.js backend can listen for it
        emit BattleRecorded(_winner, _loser, block.timestamp);
    }

    // Function to get the total number of battles played
    function getTotalBattles() public view returns (uint256) {
        return battles.length;
    }
}