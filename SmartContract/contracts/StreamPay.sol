// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StreamPay {

    struct Stream {
        address client;
        address worker;
        address verifier;      // Optional third party to verify progress
        uint256 totalDeposit;
        uint256 withdrawn;
        uint8 progress;        // 0-100 representing percentage
        bool active;
        bool finalized;
    }

    uint256 public nextStreamId;
    mapping(uint256 => Stream) public streams;

    // Events for tracking
    event StreamCreated(uint256 indexed streamId, address client, address worker, uint256 totalDeposit);
    event ProgressUpdated(uint256 indexed streamId, uint8 newProgress);
    event Withdrawn(uint256 indexed streamId, address worker, uint256 amount);
    event StreamFinalized(uint256 indexed streamId);
    event StreamCancelled(uint256 indexed streamId, uint256 workerPaid, uint256 clientRefund);

    // 🔹 Create progress-based payment stream
    function createStream(
        address worker,
        address verifier
    ) external payable {
        require(worker != address(0), "Invalid worker");
        require(msg.value > 0, "Deposit required");

        streams[nextStreamId] = Stream({
            client: msg.sender,
            worker: worker,
            verifier: verifier,  // Can be address(0) if client verifies alone
            totalDeposit: msg.value,
            withdrawn: 0,
            progress: 0,
            active: true,
            finalized: false
        });

        emit StreamCreated(nextStreamId, msg.sender, worker, msg.value);
        nextStreamId++;
    }

    // 🔹 Update progress (client or verifier only)
    function updateProgress(uint256 streamId, uint8 newProgress) external {
        Stream storage s = streams[streamId];
        require(s.active, "Stream not active");
        require(!s.finalized, "Stream already finalized");
        require(
            msg.sender == s.client || msg.sender == s.verifier,
            "Not authorized"
        );
        require(newProgress <= 100, "Progress cannot exceed 100%");
        require(newProgress >= s.progress, "Progress cannot decrease");

        s.progress = newProgress;
        emit ProgressUpdated(streamId, newProgress);

        // Auto-finalize if progress reaches 100%
        if (newProgress == 100 && !s.finalized) {
            s.finalized = true;
            emit StreamFinalized(streamId);
        }
    }

    // 🔹 Calculate total earned based on progress
    function earnedAmount(uint256 streamId) public view returns (uint256) {
        Stream memory s = streams[streamId];
        
        // Calculate: (totalDeposit * progress) / 100
        return (s.totalDeposit * s.progress) / 100;
    }

    // 🔹 Worker withdraws earned funds
    function withdraw(uint256 streamId) external {
        Stream storage s = streams[streamId];
        require(msg.sender == s.worker, "Not worker");
        require(s.active, "Stream not active");

        uint256 earned = earnedAmount(streamId);
        uint256 withdrawable = earned - s.withdrawn;

        require(withdrawable > 0, "Nothing to withdraw");

        // Checks-Effects-Interactions pattern
        s.withdrawn += withdrawable;
        emit Withdrawn(streamId, s.worker, withdrawable);
        
        payable(s.worker).transfer(withdrawable);
    }

    // 🔹 Finalize stream when work is complete
    function finalizeStream(uint256 streamId) external {
        Stream storage s = streams[streamId];
        require(s.active, "Stream not active");
        require(!s.finalized, "Already finalized");
        require(
            msg.sender == s.client || msg.sender == s.verifier,
            "Not authorized"
        );
        require(s.progress == 100, "Progress must be 100%");

        s.finalized = true;
        emit StreamFinalized(streamId);
    }

    // 🔹 Client cancels stream (refunds unearned funds)
    function cancelStream(uint256 streamId) external {
        Stream storage s = streams[streamId];
        require(msg.sender == s.client, "Only client can cancel");
        require(s.active, "Already inactive");
        require(!s.finalized, "Cannot cancel finalized stream");

        uint256 earned = earnedAmount(streamId);
        uint256 remaining = s.totalDeposit - earned;

        s.active = false;

        // Pay worker what they earned (if not withdrawn yet)
        uint256 withdrawable = earned - s.withdrawn;
        if (withdrawable > 0) {
            s.withdrawn += withdrawable;
            payable(s.worker).transfer(withdrawable);
        }

        // Refund unearned funds to client
        if (remaining > 0) {
            payable(s.client).transfer(remaining);
        }

        emit StreamCancelled(streamId, withdrawable, remaining);
    }

    // 🔹 Get stream details
    function getStream(uint256 streamId) external view returns (
        address client,
        address worker,
        address verifier,
        uint256 totalDeposit,
        uint256 withdrawn,
        uint8 progress,
        bool active,
        bool finalized
    ) {
        Stream memory s = streams[streamId];
        return (
            s.client,
            s.worker,
            s.verifier,
            s.totalDeposit,
            s.withdrawn,
            s.progress,
            s.active,
            s.finalized
        );
    }

    // 🔹 Get withdrawable amount for a worker
    function getWithdrawableAmount(uint256 streamId) external view returns (uint256) {
        Stream memory s = streams[streamId];
        if (!s.active) return 0;
        
        uint256 earned = earnedAmount(streamId);
        return earned - s.withdrawn;
    }
}