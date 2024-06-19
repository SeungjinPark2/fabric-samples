/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// Deterministic JSON.stringify()
const stringify  = require('json-stringify-deterministic');
const sortKeysRecursive  = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');
const { uuid } = require('uuidv4');
const { BigNumber } = require('bignumber.js');

class Remittance extends Contract {
    async Init(ctx, token, apiEndpoint) {
        // TODO only admin
        //if (!this.isAdmin(ctx)) {
        //    const clientIdentity = ctx.clientIdentity;
        //    const userId = clientIdentity.getAttributeValue('hf.EnrollmentID');
        //    throw new Error(`This function is restricted to admin users: your clientID is ${userId}`);
        //}

        const metadata = {
            fxRateApiToken: token,
            apiEndpoint,
        };

        const stateObj = stringify(sortKeysRecursive(metadata));

        await ctx.stub.putState(`apiToken:${token}`, Buffer.from(token));
        await ctx.stub.putState(`metadata`, Buffer.from(stateObj));

        return stateObj;
    }

    // 어드민인지 확인하는 함수
    isAdmin(ctx) {
        const clientIdentity = ctx.clientIdentity;
        const userId = clientIdentity.getAttributeValue('hf.EnrollmentID');

        const regex = /admin$/;
        return regex.test(userId);
    }

    // currencyCode 는 은행이 취급하는 법정화폐를 의미한다. 아마 배열로 만드는 것이 맞겠지만 1개로 가정하고 프로젝트를 구성한다.
    async RegisterBank(ctx, currencyCode) {
        const clientIdentity = ctx.clientIdentity;
        // 일반 유저는 SWIFTCODE 를 userId 로 가진다고 가정
        const userId = clientIdentity.getAttributeValue('hf.EnrollmentID');
        const exists = await this.BankExists(ctx, userId);

        if (exists) {
            throw new Error(`The bank ${code} already exists`);
        }

        const bank = {
            code: userId,
            currencyCode,
            available: true,
            accounts: [],
        };

        const stateObj = stringify(sortKeysRecursive(bank));

        await ctx.stub.putState(`bank:${userId}`, Buffer.from(stateObj));
        return stateObj;
    }

    async CreateAccount(ctx, bankCode) {
        const self = JSON.parse(await this.ReadBank(ctx));
        const bank = JSON.parse(await this.ReadBank(ctx, bankCode));
        const exists = self.accounts.find(b => b.code == bankCode);

        if (exists) {
            throw new Error(`The bank ${bankCode} already exists on ${self}`);
        }
        self.accounts.push({ code: bank.code, currencyCode: bank.currencyCode, liquidity: 0 });

        const stateObj = stringify(sortKeysRecursive(self))

        await ctx.stub.putState(`bank:${self.code}`, Buffer.from(stateObj));
        return stateObj;
    }

    // apply liquidity, liquidity can either be positive, negative
    async ApplyLiquidity(ctx, accountCode, liquidity, code/*: undefined || string */) {
        const bank = JSON.parse(await this.ReadBank(ctx, code));
        const account = bank.accounts.find(a => a.code == accountCode);

        if (account == null) {
            throw new Error(`Cannot find account ${accountCode}`);
        }

        const liq = new BigNumber(account.liquidity);
        const calculated = liq.plus(liquidity);

        if (calculated.lte(0)) {
            throw new Error(`Liquidity can not be negative`);
        }

        account.liquidity = calculated.toString();

        const stateObj = stringify(sortKeysRecursive(bank));

        await ctx.stub.putState(`bank:${bank.code}`, Buffer.from(stateObj));
        return stateObj;
    }
    /*
        sender{receiver}Info: {
            name: string,
            birthday: timestamp,
            address: string,
            phoneNumber: string,
        };
        participant: {
            code: string,
            approved: boolean,
            type: 'sender' | 'intermediary' | 'receiver',
            reason: string, // empty or reason with not approving
            currencyCode: string,
        };
        transaction: {
            id: transaction_id,
            senderInfo,
            receiverInfo,
            value: string,
            participants: participant[],
            status: 'pending' | 'failed' | 'done',
            createTime: timestamp,
            fxRates: [
                'KRW:USD:0.000727',
                ...
            ]
        };
    */
    async ProposeTransaction(ctx, senderInfo, receiverInfo, value, participants) {
        const participants_ = JSON.parse(participants);
        const senderInfo_ = JSON.parse(senderInfo);
        const receiverInfo_ = JSON.parse(receiverInfo);

        let _value;
        let _participants = [];
        let fxRates = [];
        const id = uuid();
        const metadata = JSON.parse(await ctx.stub.getState('metadata'));

        // input 값 검증
        if (!Array.isArray(participants_)) {
            throw new Error(`Argument participants should be array`);
        }
        if (participants_.length === 0) {
            throw new Error(`Length of participants is at least 1`);
        }

        if (isNaN(value)) {
            throw new Error(`Value should be number`);
        } else {
            _value = new BigNumber(value);
            if (_value.lte(0)) {
                throw new Error(`Value can not be negative`);
            }
        }

        _participants = [
            {
                code: await ctx.clientIdentity.getAttributeValue('hf.EnrollmentID'),
                type: 'sender',
            },
            ...participants_.map(p => ({ code: p.code, type: p.type })),
        ];

        // 참여자를 ReadBank 하여 가져옴
        const fetchedParticipants = await Promise.all(_participants.map(p =>
            this.ReadBank(ctx, p.code).then(bank => ({
                ...JSON.parse(bank),
                type: p.type,
            })),
        ));

        for (let i = 0; i < fetchedParticipants.length - 1; i++) {
            const current = fetchedParticipants[i];
            const next = fetchedParticipants[i + 1];
            const exists = current.accounts.find(a => a.code === next.code);

            if (exists == null) {
                throw new Error(`The bank ${next.code} does not exists on ${current.code}`);
            }
        }

        const currencies = [...new Set(fetchedParticipants.map(p => p.currencyCode))];

        // 환율을 구한다.
        if (currencies.length > 1) {
            const fetches = [];
            const getFxRate = async (base, currency) => fetch(`${metadata.apiEndpoint}/latest?base=${base}&currencies=${currency}&resolution=1m&amount=1&places=6&format=json&api_key=${metadata.apiToken}`)
                .then(res => res.json())
                .catch(err => { throw new Error(`Fetch failed, reason: ${err.message}`)});

            for (let i = 0; i < currencies.length - 1; i++) {
                fetches.push(getFxRate(currencies[i], currencies[i + 1]));
            }

            fxRates = (await Promise.all(fetches)).map(rate => ({
                base: rate.base,
                target: rate.rates,
            }));
        }

        const receipts = [];
        let __value = _value;
        // 영수증 발행. 추후 approve 가 완료되면 적용되는 구조이다.
        for (let i = 0; i < fetchedParticipants.length; i++) {
            const current = fetchedParticipants[i];
            const next = i < fetchedParticipants.length - 1 ? fetchedParticipants[i + 1] : null;
            const before = i > 0 ? fetchedParticipants[i - 1] : null;
            let rate = 1;

            if (before !== null) {
                if (current.currencyCode !== before.currencyCode) {
                    const fRate = fxRates.find(f => f.base === before.currencyCode);
                    if (rate == null) {
                        throw new Error(`Can not find fxRate, base:${before.currencyCode} target: ${current.currencyCode}`);
                    };
                    rate = fRate.target[current.currencyCode];
                }
            }

            const list = [];
            before && list.push({ target: before.code, value: __value.multipliedBy(rate).negated().toString() });
            next   && list.push({ target: next.code, value: __value.multipliedBy(rate).toString() });
            receipts.push({
                code: current.code,
                list,
            });

            __value = __value.multipliedBy(rate);
        }

        _participants = fetchedParticipants.map((fp, i) => ({
            code: fp.code,
            approved: i === 0,
            type: i === 0 ? 'sender' : fp.type,
            reason: '', // empty or reason with not approving
            currencyCode: fp.currencyCode,
        }));

        const transaction = {
            id,
            senderInfo: {
                name: senderInfo_.name,
                birthday: senderInfo_.birthday,
                address: senderInfo_.address,
                phoneNumber: senderInfo_.phoneNumber,
            },
            receiverInfo: {
                name: receiverInfo_.name,
                birthday: receiverInfo_.birthday,
                address: receiverInfo_.address,
                phoneNumber: receiverInfo_.phoneNumber,
            },
            value: _value.toString(),
            participants: _participants,
            fxRates,
            status: 'pending',
            createTime: Date.now(),
        };

        const stateObj = stringify(sortKeysRecursive(transaction));
        await ctx.stub.putState(`transaction:${id}`, Buffer.from(stateObj));
        await ctx.stub.putState(`receipt:${id}`, Buffer.from(stringify(sortKeysRecursive({'foo': 'bar'}))));
        ctx.stub.setEvent('ProposeTransactionEvent', Buffer.from(stateObj));

        return stateObj;
    }

    async ApproveTransaction(ctx, id, choice /*: approve | reject */, reason /*: undefined | string*/) {
        const bank = JSON.parse(await this.ReadBank(ctx));
        const tx = JSON.parse(await this.ReadTransaction(ctx, id));
        const participant = tx.participants.find(p => p.code === bank.code);
        let flag = true;

        if (tx.status !== 'pending') {
            throw new Error(`Transaction ${id} is already done or failed`);
        }
        if (participant == null) {
            throw new Error(`Bank ${bank.code} is not a participant of transaction ${id}`);
        }

        participant.approved = choice === 'approve';
        if (choice === 'reject') {
            tx.status = 'failed';
            participant.reason = reason;
        }

        tx.participants.forEach(p => {
            flag = flag && p.approved;
        });

        if (flag) {
            await this.ApplyReceipt(ctx, id);
            tx.status = 'done';
        }

        const stateObj = stringify(sortKeysRecursive(tx));
        await ctx.stub.putState(`transaction:${id}`, Buffer.from(stateObj));
        ctx.stub.setEvent('ApproveTransactionEvent', Buffer.from(stateObj));

        return stateObj;
    }

    async ApplyReceipt(ctx, id) {
        const receipt = JSON.parse(await this.ReadReceipt(ctx, id));
        for (const r of receipt) {
            for (const l of r.list) {
                await this.ApplyLiquidity(ctx, l.target, l.value, r.code);
            }
        }

        ctx.stub.setEvent('ApplyReceiptEvent', stringify(sortKeysRecursive(receipt)));
    }

    async ReadBank(ctx, code) {
        let bankJSON;
        if (code) {
            bankJSON = await ctx.stub.getState(`bank:${code}`); // get the bank from chaincode state
        } else {
            const clientIdentity = ctx.clientIdentity;
            const userId = clientIdentity.getAttributeValue('hf.EnrollmentID');
            bankJSON = await ctx.stub.getState(`bank:${userId}`); // get the bank from chaincode state
        }

        if (!bankJSON || bankJSON.length === 0) {
            throw new Error(`The asset ${code} does not exist`);
        }
        return bankJSON.toString();
    }

    async ReadTransaction(ctx, id) {
        const txJson = await ctx.stub.getState(`transaction:${id}`); // get the bank from chaincode state
        if (!txJson || txJson.length === 0) {
            throw new Error(`The asset ${id} does not exist`);
        }
        return txJson.toString();
    }

    async ReadReceipt(ctx, id) {
        const receiptJson = await ctx.stub.getState(`receipt:${id}`);
        if (!receiptJson || receiptJson.length === 0) {
            throw new Error(`The asset ${id} does not exist`);
        }
        return receiptJson.toString();
    }

    async BankExists(ctx, code) {
        const bankJSON = await ctx.stub.getState(`bank:${code}`);
        return bankJSON && bankJSON.length > 0;
    }
}

module.exports = Remittance;
