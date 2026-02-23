# StreamPay - Progress-Based Payment System

A Solidity smart contract for escrow payments released based on work progress rather than time.

## Features

- **Progress-Based Payments**: Payments released as percentage (0-100%) instead of time
- **Third-Party Verification**: Optional verifier role for independent progress confirmation
- **Fair Cancellation**: Automatic fund distribution on cancellation (worker gets earned, client gets refund)
- **Security**: Reentrancy protection, progress validation, authorization controls
- **Flexible Withdrawals**: Workers withdraw anytime as progress updates

## Payment Formula

```
earnedAmount = (totalDeposit × progress) / 100
withdrawable = earnedAmount - withdrawn
```

## Contract Structure

### Roles
- **Client**: Creates stream, updates progress, can cancel
- **Worker**: Receives payments, can withdraw earned funds
- **Verifier**: Optional third-party who can update progress

### Main Functions
- `createStream(worker, verifier)` - Create payment stream with ETH deposit
- `updateProgress(streamId, progress)` - Update work completion (0-100%)
- `withdraw(streamId)` - Worker claims earned funds
- `cancelStream(streamId)` - Client cancels with fair refund
- `getWithdrawableAmount(streamId)` - Check available funds

## Installation

```bash
npm install
```

## Usage

### Compile Contract
```bash
npx hardhat compile
```

### Run Tests
```bash
npx hardhat test
```

### Visual Test Report
```bash
npx hardhat run scripts/visual-test-report.js
```

### Deploy
```bash
npx hardhat run scripts/deploy.js --network <network-name>
```

## Example Flow

1. **Client creates stream**: Deposits 10 ETH for worker
2. **Progress at 25%**: Worker can withdraw 2.5 ETH
3. **Progress at 50%**: Worker withdraws another 2.5 ETH
4. **Progress at 100%**: Auto-finalizes, worker withdraws remaining 5 ETH

## Testing

The contract includes 29 comprehensive tests covering:
- Stream creation
- Progress updates
- Earned amount calculations
- Withdrawals
- Cancellations
- Finalization
- Security controls

All tests pass with 100% success rate.

## Tech Stack

- Solidity ^0.8.20
- Hardhat 2.22.0
- Ethers.js 6.4.0
- Chai (testing)

## Security Features

✅ Progress can only increase (cannot go backwards)  
✅ Progress capped at 100%  
✅ Authorization enforced (only client/verifier update progress)  
✅ Reentrancy protection  
✅ Withdrawal limits enforced  
✅ Fair fund distribution on cancellation  

## License

MIT
