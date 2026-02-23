import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("StreamPay - Progress-Based Payments", function () {
    let streamPay;
    let client, worker, verifier, other;

    beforeEach(async function () {
        [client, worker, verifier, other] = await ethers.getSigners();
        
        const StreamPay = await ethers.getContractFactory("StreamPay");
        streamPay = await StreamPay.deploy();
        await streamPay.waitForDeployment();
    });

    describe("Stream Creation", function () {
        it("Should create a stream with correct initial values", async function () {
            const deposit = ethers.parseEther("10");
            
            await streamPay.connect(client).createStream(
                worker.address,
                verifier.address,
                { value: deposit }
            );

            const stream = await streamPay.getStream(0);
            expect(stream.client).to.equal(client.address);
            expect(stream.worker).to.equal(worker.address);
            expect(stream.verifier).to.equal(verifier.address);
            expect(stream.totalDeposit).to.equal(deposit);
            expect(stream.withdrawn).to.equal(0);
            expect(stream.progress).to.equal(0);
            expect(stream.active).to.equal(true);
            expect(stream.finalized).to.equal(false);
        });

        it("Should reject stream creation with invalid worker", async function () {
            await expect(
                streamPay.connect(client).createStream(
                    ethers.ZeroAddress,
                    verifier.address,
                    { value: ethers.parseEther("1") }
                )
            ).to.be.revertedWith("Invalid worker");
        });

        it("Should reject stream creation without deposit", async function () {
            await expect(
                streamPay.connect(client).createStream(
                    worker.address,
                    verifier.address,
                    { value: 0 }
                )
            ).to.be.revertedWith("Deposit required");
        });
    });

    describe("Progress Updates", function () {
        beforeEach(async function () {
            await streamPay.connect(client).createStream(
                worker.address,
                verifier.address,
                { value: ethers.parseEther("10") }
            );
        });

        it("Should allow client to update progress", async function () {
            await streamPay.connect(client).updateProgress(0, 25);
            const stream = await streamPay.getStream(0);
            expect(stream.progress).to.equal(25);
        });

        it("Should allow verifier to update progress", async function () {
            await streamPay.connect(verifier).updateProgress(0, 50);
            const stream = await streamPay.getStream(0);
            expect(stream.progress).to.equal(50);
        });

        it("Should reject unauthorized progress updates", async function () {
            await expect(
                streamPay.connect(other).updateProgress(0, 25)
            ).to.be.revertedWith("Not authorized");
        });

        it("Should reject decreasing progress", async function () {
            await streamPay.connect(client).updateProgress(0, 50);
            await expect(
                streamPay.connect(client).updateProgress(0, 25)
            ).to.be.revertedWith("Progress cannot decrease");
        });

        it("Should reject progress exceeding 100%", async function () {
            await expect(
                streamPay.connect(client).updateProgress(0, 150)
            ).to.be.revertedWith("Progress cannot exceed 100%");
        });

        it("Should auto-finalize at 100% progress", async function () {
            await streamPay.connect(client).updateProgress(0, 100);
            const stream = await streamPay.getStream(0);
            expect(stream.finalized).to.equal(true);
        });
    });

    describe("Earned Amount Calculation", function () {
        beforeEach(async function () {
            await streamPay.connect(client).createStream(
                worker.address,
                verifier.address,
                { value: ethers.parseEther("10") }
            );
        });

        it("Should calculate 0% correctly", async function () {
            const earned = await streamPay.earnedAmount(0);
            expect(earned).to.equal(0);
        });

        it("Should calculate 25% correctly", async function () {
            await streamPay.connect(client).updateProgress(0, 25);
            const earned = await streamPay.earnedAmount(0);
            expect(earned).to.equal(ethers.parseEther("2.5"));
        });

        it("Should calculate 50% correctly", async function () {
            await streamPay.connect(client).updateProgress(0, 50);
            const earned = await streamPay.earnedAmount(0);
            expect(earned).to.equal(ethers.parseEther("5"));
        });

        it("Should calculate 100% correctly", async function () {
            await streamPay.connect(client).updateProgress(0, 100);
            const earned = await streamPay.earnedAmount(0);
            expect(earned).to.equal(ethers.parseEther("10"));
        });
    });

    describe("Withdrawals", function () {
        beforeEach(async function () {
            await streamPay.connect(client).createStream(
                worker.address,
                verifier.address,
                { value: ethers.parseEther("10") }
            );
        });

        it("Should allow worker to withdraw earned funds", async function () {
            await streamPay.connect(client).updateProgress(0, 25);
            
            const balanceBefore = await ethers.provider.getBalance(worker.address);
            await streamPay.connect(worker).withdraw(0);
            const balanceAfter = await ethers.provider.getBalance(worker.address);

            // Should receive approximately 2.5 ETH (minus gas)
            const received = balanceAfter - balanceBefore;
            expect(received).to.be.closeTo(
                ethers.parseEther("2.5"),
                ethers.parseEther("0.01") // Allow for gas costs
            );
        });

        it("Should track withdrawn amount correctly", async function () {
            await streamPay.connect(client).updateProgress(0, 25);
            await streamPay.connect(worker).withdraw(0);

            const stream = await streamPay.getStream(0);
            expect(stream.withdrawn).to.equal(ethers.parseEther("2.5"));
        });

        it("Should allow multiple withdrawals", async function () {
            await streamPay.connect(client).updateProgress(0, 25);
            await streamPay.connect(worker).withdraw(0);

            await streamPay.connect(client).updateProgress(0, 50);
            await streamPay.connect(worker).withdraw(0);

            const stream = await streamPay.getStream(0);
            expect(stream.withdrawn).to.equal(ethers.parseEther("5"));
        });

        it("Should reject withdrawal by non-worker", async function () {
            await streamPay.connect(client).updateProgress(0, 25);
            await expect(
                streamPay.connect(other).withdraw(0)
            ).to.be.revertedWith("Not worker");
        });

        it("Should reject withdrawal when nothing to withdraw", async function () {
            await streamPay.connect(client).updateProgress(0, 25);
            await streamPay.connect(worker).withdraw(0);

            // Try to withdraw again immediately
            await expect(
                streamPay.connect(worker).withdraw(0)
            ).to.be.revertedWith("Nothing to withdraw");
        });
    });

    describe("Stream Cancellation", function () {
        beforeEach(async function () {
            await streamPay.connect(client).createStream(
                worker.address,
                verifier.address,
                { value: ethers.parseEther("10") }
            );
        });

        it("Should cancel stream and distribute funds correctly", async function () {
            await streamPay.connect(client).updateProgress(0, 40);

            const clientBalanceBefore = await ethers.provider.getBalance(client.address);
            const workerBalanceBefore = await ethers.provider.getBalance(worker.address);

            const tx = await streamPay.connect(client).cancelStream(0);
            const receipt = await tx.wait();
            const gasCost = receipt.gasUsed * receipt.gasPrice;

            const clientBalanceAfter = await ethers.provider.getBalance(client.address);
            const workerBalanceAfter = await ethers.provider.getBalance(worker.address);

            // Worker should receive 4 ETH (40% of 10 ETH)
            expect(workerBalanceAfter - workerBalanceBefore).to.equal(
                ethers.parseEther("4")
            );

            // Client should receive 6 ETH refund (minus gas)
            expect(clientBalanceAfter - clientBalanceBefore + gasCost).to.equal(
                ethers.parseEther("6")
            );

            const stream = await streamPay.getStream(0);
            expect(stream.active).to.equal(false);
        });

        it("Should handle cancellation after partial withdrawal", async function () {
            await streamPay.connect(client).updateProgress(0, 50);
            await streamPay.connect(worker).withdraw(0); // Withdraw 5 ETH

            const clientBalanceBefore = await ethers.provider.getBalance(client.address);
            const workerBalanceBefore = await ethers.provider.getBalance(worker.address);

            const tx = await streamPay.connect(client).cancelStream(0);
            const receipt = await tx.wait();
            const gasCost = receipt.gasUsed * receipt.gasPrice;

            const clientBalanceAfter = await ethers.provider.getBalance(client.address);
            const workerBalanceAfter = await ethers.provider.getBalance(worker.address);

            // Worker already withdrew 5 ETH, so no additional payment
            expect(workerBalanceAfter).to.equal(workerBalanceBefore);

            // Client should receive 5 ETH refund (50% remaining)
            expect(clientBalanceAfter - clientBalanceBefore + gasCost).to.equal(
                ethers.parseEther("5")
            );
        });

        it("Should reject cancellation by non-client", async function () {
            await expect(
                streamPay.connect(other).cancelStream(0)
            ).to.be.revertedWith("Only client can cancel");
        });

        it("Should reject cancellation of inactive stream", async function () {
            await streamPay.connect(client).cancelStream(0);
            await expect(
                streamPay.connect(client).cancelStream(0)
            ).to.be.revertedWith("Already inactive");
        });

        it("Should reject cancellation of finalized stream", async function () {
            await streamPay.connect(client).updateProgress(0, 100);
            await expect(
                streamPay.connect(client).cancelStream(0)
            ).to.be.revertedWith("Cannot cancel finalized stream");
        });
    });

    describe("Stream Finalization", function () {
        beforeEach(async function () {
            await streamPay.connect(client).createStream(
                worker.address,
                verifier.address,
                { value: ethers.parseEther("10") }
            );
        });

        it("Should finalize stream at 100% progress", async function () {
            await streamPay.connect(client).createStream(
                worker.address,
                verifier.address,
                { value: ethers.parseEther("10") }
            );
            await streamPay.connect(client).updateProgress(0, 100);
            const stream = await streamPay.getStream(0);
            expect(stream.finalized).to.equal(true);
        });

        it("Should verify finalization is automatic at 100%", async function () {
            await streamPay.connect(client).createStream(
                worker.address,
                verifier.address,
                { value: ethers.parseEther("2") }
            );
            
            await streamPay.connect(client).updateProgress(0, 100);
            const stream = await streamPay.getStream(0);
            // Auto-finalized
            expect(stream.finalized).to.equal(true);
            expect(stream.progress).to.equal(100);
        });

        it("Should reject finalization before 100%", async function () {
            await streamPay.connect(client).createStream(
                worker.address,
                verifier.address,
                { value: ethers.parseEther("5") }
            );
            await streamPay.connect(client).updateProgress(0, 50);
            await expect(
                streamPay.connect(client).finalizeStream(0)
            ).to.be.revertedWith("Progress must be 100%");
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            await streamPay.connect(client).createStream(
                worker.address,
                verifier.address,
                { value: ethers.parseEther("10") }
            );
        });

        it("Should return correct withdrawable amount", async function () {
            await streamPay.connect(client).updateProgress(0, 30);
            const withdrawable = await streamPay.getWithdrawableAmount(0);
            expect(withdrawable).to.equal(ethers.parseEther("3"));
        });

        it("Should return zero after full withdrawal", async function () {
            await streamPay.connect(client).updateProgress(0, 30);
            await streamPay.connect(worker).withdraw(0);
            const withdrawable = await streamPay.getWithdrawableAmount(0);
            expect(withdrawable).to.equal(0);
        });

        it("Should return correct stream details", async function () {
            const stream = await streamPay.getStream(0);
            expect(stream.client).to.equal(client.address);
            expect(stream.worker).to.equal(worker.address);
            expect(stream.totalDeposit).to.equal(ethers.parseEther("10"));
        });
    });
});
