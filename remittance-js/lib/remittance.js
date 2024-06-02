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
    async RegisterBank(ctx, code, currencyCode) {
        const exists = await this.BankExists(ctx, code);

        if (exists) {
            throw new Error(`The bank ${code} already exists`);
        }

        const bank = {
            code,
            currencyCode,
            available: true,
            accounts: [],
        };

        await ctx.stub.putState(`bank:${code}`, Buffer.from(stringify(sortKeysRecursive(bank))));
        return JSON.stringify(bank);
    }

    async CreateAccount(ctx, bank1Code, bank2Code) {
        const bank1 = JSON.parse(await this.ReadBank(ctx, bank1Code));
        const bank2 = JSON.parse(await this.ReadBank(ctx, bank2Code));

        const exists = bank1.accounts.find(b => b.code == bank2Code);

        if (exists) {
            throw new Error(`The bank ${bank2Code} already exists on ${bank1Code}`);
        }

        bank1.accounts.push({ code: bank2.code, currencyCode: bank2.currencyCode, liquidity: 0 });
        bank2.accounts.push({ code: bank1.code, currencyCode: bank1.currencyCode, liquidity: 0 });

        await ctx.stub.putState(`bank:${bank1.code}`, Buffer.from(stringify(sortKeysRecursive(bank1))));
        await ctx.stub.putState(`bank:${bank2.code}`, Buffer.from(stringify(sortKeysRecursive(bank2))));
    }

    // apply liquidity, liquidity can either be positive, negative
    async ApplyLiquidity(ctx, code, accountCode, liquidity) {
        const bank = JSON.parse(await this.ReadBank(ctx, code));
        const account = bank.accounts.find(a => a.code == accountCode);

        if (account == null) {
            throw new Error(`The bank ${code} does not hold account ${accountCode}`);
        }

        const calculated = account.liquidity + liquidity;
        if (calculated < 0) {
            throw new Error(`Liquidity can not be negative`);
        }

        account.liquidity = calculated;
        await ctx.stub.putState(`bank:${bank.code}`, Buffer.from(stringify(sortKeysRecursive(bank))));
    }

    async ReadBank(ctx, code) {
        const bankJSON = await ctx.stub.getState(`bank:${code}`); // get the bank from chaincode state
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
        };
        transaction: {
            id: transaction_id,
            senderInfo,
            receiverInfo,
            value: string,
            participants: participant[],
            status: 'pending' | 'failed' | 'done',
            createTime: timestamp,
            fxRates: [], // todo
        };
    */
    async ProposeTransaction(ctx, senderInfo, receiverInfo, value, participants) {
        let _value;
        const _participants = [];
        const id = uuid();

        if (!Array.isArray(participants)) {
            throw new Error(`Argument participants should be array`);
        }
        if (participants.filter(p => p.type === 'sender').length !== 1
            || participants.filter(p => p.type === 'receiver').length !== 1
            || participants[0].type !== 'sender'
            || participants.pop().type !== 'receiver'
        ) {
            throw new Error(`Argument participants can have only one sender and receiver also first participant is sender and last one is receiver`);
        } else {
            for (const p of participants) {
                if (['sender', 'intermediary', 'receiver'].find(t => t === p.type) == null) {
                    throw new Error(`Participants should has type in sender, intermediary, receiver`);
                }
                const b = JSON.parse(await this.ReadBank(ctx, p.code));
                _participants.push({
                    code: b.code,
                    approved: p.type === 'sender', // only sender is approved
                    type: p.type,
                    reason: '', // empty or reason with not approving
                });
            }
        }
        if (isNaN(value)) {
            throw new Error(`Value should be number`);
        } else {
            _value = new BigNumber(value);
            if (_value.lte(0)) {
                throw new Error(`Value can not be negative`);
            }
        }

        const transaction = {
            id,
            senderInfo: {
                name: senderInfo.name,
                birthday: senderInfo.birthday,
                address: senderInfo.address,
                phoneNumber: senderInfo.phoneNumber,
            },
            receiverInfo: {
                name: receiverInfo.name,
                birthday: receiverInfo.birthday,
                address: receiverInfo.address,
                phoneNumber: receiverInfo.phoneNumber,
            },
            value: _value.toString(),
            participants: _participants,
            createTime: Date.now(),
        };

        await ctx.stub.putState(`transaction:${id}`, Buffer.from(stringify(sortKeysRecursive(transaction))));
        return id;
    }

    // UpdateAsset updates an existing asset in the world state with provided parameters.
    // async UpdateAsset(ctx, id, color, size, owner, appraisedValue) {
    //     const exists = await this.AssetExists(ctx, id);
    //     if (!exists) {
    //         throw new Error(`The asset ${id} does not exist`);
    //     }

    //     // overwriting original asset with new asset
    //     const updatedAsset = {
    //         ID: id,
    //         Color: color,
    //         Size: size,
    //         Owner: owner,
    //         AppraisedValue: appraisedValue,
    //     };
    //     // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
    //     return ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(updatedAsset))));
    // }

    // DeleteAsset deletes an given asset from the world state.
    // async DeleteAsset(ctx, id) {
    //     const exists = await this.AssetExists(ctx, id);
    //     if (!exists) {
    //         throw new Error(`The asset ${id} does not exist`);
    //     }
    //     return ctx.stub.deleteState(id);
    // }

    // AssetExists returns true when asset with given ID exists in world state.
    // async AssetExists(ctx, id) {
    //     const assetJSON = await ctx.stub.getState(id);
    //     return assetJSON && assetJSON.length > 0;
    // }

    async BankExists(ctx, code) {
        const bankJSON = await ctx.stub.getState(`bank:${code}`);
        return bankJSON && bankJSON.length > 0;
    }

    // TransferAsset updates the owner field of asset with given id in the world state.
    // async TransferAsset(ctx, id, newOwner) {
    //     const assetString = await this.ReadAsset(ctx, id);
    //     const asset = JSON.parse(assetString);
    //     const oldOwner = asset.Owner;
    //     asset.Owner = newOwner;
    //     // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
    //     await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(asset))));
    //     return oldOwner;
    // }

    // GetAllAssets returns all assets found in the world state.
    // async GetAllAssets(ctx) {
    //     const allResults = [];
    //     // range query with empty string for startKey and endKey does an open-ended query of all assets in the chaincode namespace.
    //     const iterator = await ctx.stub.getStateByRange('', '');
    //     let result = await iterator.next();
    //     while (!result.done) {
    //         const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
    //         let record;
    //         try {
    //             record = JSON.parse(strValue);
    //         } catch (err) {
    //             console.log(err);
    //             record = strValue;
    //         }
    //         allResults.push(record);
    //         result = await iterator.next();
    //     }
    //     return JSON.stringify(allResults);
    // }
}

module.exports = Remittance;
