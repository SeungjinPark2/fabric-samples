'use strict';

const stringify = require('json-stringify-deterministic');
const sortKeysRecursive = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');
const { BigNumber } = require('bignumber.js');
const { stateParser } = require('../utils');
const { getFxRate } = require('./getFxRate');
const { uuid } = require('uuidv4');

const TxStatus = {
    ONGOING: 0,
    DONE: 1,
    REJECTED: 2,
};

const AgreementStatus = {
    ONGOING: 0,
    DONE: 1,
    REJECTED: 2,
};

class Remittance extends Contract {
    async Init(ctx, token, apiEndpoint, fee) {
        const metadata = {
            apiToken: token,
            apiEndpoint,
            fee,
        };
        const stateObj = stringify(sortKeysRecursive(metadata));
        await ctx.stub.putState('metadata', Buffer.from(stateObj));

        return stateObj;
    }

    // 블록체인에 피어 노드로 참여한 은행은 체인코드에 스스로를 등록하는 절차를 가져야 한다.
    // currencyCode 는 해당 은행이 취급하는 화폐로 단순화를 위해 단일 종류의 화폐를 취급한다고 가정.
    async RegisterBank(ctx, currencyCode) {
        const clientIdentity = ctx.clientIdentity;
        // 피어노드로 참여할 때 사용된 ID를 은행코드로 사용한다.
        const bankCode = clientIdentity.getAttributeValue('hf.EnrollmentID');
        const exists = await this.BankExists(ctx, bankCode);

        if (exists) {
            throw new Error(`The bank ${bankCode} already exists`);
        }

        const stateObj = stringify(
            sortKeysRecursive({
                code: bankCode,
                currencyCode,
                correnpondentBanks /*: string[] */: [],
            })
        );

        await ctx.stub.putState(`bank:${bankCode}`, Buffer.from(stateObj));

        return JSON.parse(stateObj);
    }

    // 환거래은행 관계를 맺게되는 함수,
    async CreateAccount(ctx, bankCode) {
        const ourCode = ctx.clientIdentity.getAttributeValue('hf.EnrollmentID');
        const self = stateParser(await this.ReadBank(ctx, ourCode));
        const exists = self.correnpondentBanks.find((c) => c === bankCode);

        if (exists) {
            throw new Error(
                `The bank ${bankCode} already exists on ${ourCode}`
            );
        }

        self.correnpondentBanks.push(bankCode);
        const stateObj = stringify(sortKeysRecursive(self));
        await ctx.stub.putState(`bank:${self.code}`, Buffer.from(stateObj));

        return stateObj;
    }

    // 중계은행을 포함한 여러 루트를 찾는다, 마지막 인자에 따라 최대 탐색 깊이를 설정한다.
    async FindRoutes(
        ctx,
        finalBankCode,
        routes, // final routes [[...], [...], [...], ...]
        cr, // current route, initial value to be [currentBankCode]
        maxParticipant = 3 // 최대 루트 길이 (max depth)
    ) {
        if (cr[cr.length - 1] === finalBankCode) return true;
        else if (cr.length === maxParticipant) return false;

        const cb = stateParser(await this.ReadBank(ctx, cr[cr.length - 1]));

        for (const cc of cb.correnpondentBanks) {
            if (cr.find((_c) => _c === cc) != null) continue; // 이제껏 선택해온 것은 들여다 보지 않음.
            cr.push(cc);

            const found = await this.FindRoutes(
                ctx,
                finalBankCode,
                routes,
                [...cr], // 얕은복사
                maxParticipant
            );

            if (found) routes.push([...cr]);
            cr.pop();
        }

        return false;
    }

    // 트렌젝션 시뮬레이션, 참여자 및 수수료 등 미리 확인.
    async PreflightTx(ctx, sender, receiver, receiverBankCode, amount) {
        const metadata = JSON.parse(await ctx.stub.getState('metadata'));
        const fee = metadata.fee / 100; // 수수료율
        const senderBankCode =
            ctx.clientIdentity.getAttributeValue('hf.EnrollmentID');

        const routes /*: code[]*/ = [];
        await this.FindRoutes(ctx, receiverBankCode, routes, [senderBankCode]);

        const preparedTxs = [];

        // 간단하게 2중 for문으로 해결. 실제 사례에서는 성능을 생각해서 병렬적으로 구성해야함.
        for (let i = 0; i < routes.length; i++) {
            let _amount = new BigNumber(amount);
            const agreements = [];

            // 각 route 에 관해 환율과 수수료에 따른 값 변화를 나타냄.
            for (let j = 0; j < routes[i].length - 1; j++) {
                let cb = stateParser(await this.ReadBank(ctx, routes[i][j]));
                const nb = stateParser(
                    await this.ReadBank(ctx, routes[i][j + 1])
                );

                const rate = await getFxRate(
                    metadata,
                    cb.currencyCode,
                    nb.currencyCode
                );

                const collected = _amount
                    .multipliedBy(fee)
                    .decimalPlaces(6, BigNumber.ROUND_HALF_UP);
                const nAmount = _amount.minus(collected);
                _amount = nAmount
                    .multipliedBy(rate)
                    .decimalPlaces(6, BigNumber.ROUND_HALF_UP);

                agreements.push({
                    code: cb.code,
                    currencyCode: cb.currencyCode,
                    collectedFee: collected.toString(),
                    amount: nAmount.toString(),
                });

                // 마지막 케이스에만 한번 더 구해줌.
                // TODO 코드 줄일 방법 모색.
                if (j === routes[i].length - 2) {
                    const collected = _amount
                        .multipliedBy(fee)
                        .decimalPlaces(6, BigNumber.ROUND_HALF_UP);
                    const nAmount = _amount.minus(collected);

                    agreements.push({
                        code: nb.code,
                        currencyCode: nb.currencyCode,
                        collectedFee: collected.toString(),
                        amount: nAmount.toString(),
                    });
                }
            }

            preparedTxs.push(agreements);
        }

        return {
            sender,
            receiver,
            preparedTxs,
        };
    }

    /* txObject
    sender: {
        firstname: string,
        lastname: string,
        accountNumber: string,
    },
    receiver: {
        firstname: string,
        lastname: string,
        accountNumber: string,
    },
    agreements: [
        {
            code: nb.code,
            currencyCode: nb.currencyCode,
            collectedFee: collected.toString(),
            amount: nAmount.toString(), 
        },
        ...
    ]
    */
    async ProposeTransaction(ctx, txObject) {
        const code = ctx.clientIdentity.getAttributeValue('hf.EnrollmentID');

        txObject.agreements = txObject.agreements.map((t) => ({
            ...t,
            status:
                t.code === code
                    ? AgreementStatus.DONE
                    : AgreementStatus.ONGOING, // 발의한 은행은 동의한것으로 간주
        }));

        txObject.id = uuid();
        txObject.status = AgreementStatus.ONGOING;
        txObject.reason = '';

        const stateObj = stringify(sortKeysRecursive(txObject));
        await ctx.stub.putState(
            `transaction:${txObject.id}`,
            Buffer.from(stateObj)
        );
        return stateObj;
    }

    async ApproveTransaction(
        ctx,
        id,
        choice /* 'approve' | 'reject' */,
        reason = ''
    ) {
        const code = ctx.clientIdentity.getAttributeValue('hf.EnrollmentID');
        const tx = stateParser(await this.ReadTransaction(ctx, id));
        const agreements = tx.agreements;
        const agreementUnit = agreements.find((a) => a.code === code);

        if (
            tx.status !== TxStatus.ONGOING ||
            agreementUnit.status !== AgreementStatus.ONGOING
        ) {
            throw new Error(`Invalid approval trial for transaction ${id}`);
        }

        if (choice === 'reject') {
            tx.status = TxStatus.REJECTED;
            tx.reason = reason;
            // make event
        } else {
            agreementUnit.status = AgreementStatus.DONE;
        }

        let allUnitsAreApproved = true;
        for (const unit of agreements) {
            if (unit.status !== AgreementStatus.DONE)
                allUnitsAreApproved = false;
        }
        if (allUnitsAreApproved) tx.status = TxStatus.DONE;

        const stateObj = stringify(sortKeysRecursive(tx));
        await ctx.stub.putState(`transaction:${id}`, Buffer.from(stateObj));

        return stateObj;
    }

    async ReadBank(ctx, code) {
        const bank = await ctx.stub.getState(`bank:${code}`); // get the bank from chaincode state

        if (!bank || bank.length === 0) {
            throw new Error(`The bank ${code} does not exist`);
        }

        return bank;
    }

    async ReadTransaction(ctx, id) {
        const tx = await ctx.stub.getState(`transaction:${id}`); // get the bank from chaincode state
        if (!tx || tx.length === 0) {
            throw new Error(`The asset ${id} does not exist`);
        }
        return tx;
    }

    async BankExists(ctx, code) {
        const bankJSON = await ctx.stub.getState(`bank:${code}`);
        return bankJSON && bankJSON.length > 0;
    }
}

module.exports = Remittance;
