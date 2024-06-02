/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
*/

'use strict';
const sinon = require('sinon');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const expect = chai.expect;

const { Context } = require('fabric-contract-api');
const { ChaincodeStub } = require('fabric-shim');

const Remittance = require('../lib/remittance.js');

let assert = sinon.assert;
chai.use(sinonChai);

describe('Remittance Tests', () => {
    let transactionContext, chaincodeStub, bank, bank2, bank3, senderInfo, receiverInfo, participants;
    beforeEach(() => {
        transactionContext = new Context();

        chaincodeStub = sinon.createStubInstance(ChaincodeStub);
        transactionContext.setChaincodeStub(chaincodeStub);

        chaincodeStub.putState.callsFake((key, value) => {
            if (!chaincodeStub.states) {
                chaincodeStub.states = {};
            }
            chaincodeStub.states[key] = value;
        });

        chaincodeStub.getState.callsFake(async (key) => {
            let ret;
            if (chaincodeStub.states) {
                ret = chaincodeStub.states[key];
            }
            return Promise.resolve(ret);
        });

        chaincodeStub.deleteState.callsFake(async (key) => {
            if (chaincodeStub.states) {
                delete chaincodeStub.states[key];
            }
            return Promise.resolve(key);
        });

        chaincodeStub.getStateByRange.callsFake(async () => {
            function* internalGetStateByRange() {
                if (chaincodeStub.states) {
                    // Shallow copy
                    const copied = Object.assign({}, chaincodeStub.states);

                    for (let key in copied) {
                        yield {value: copied[key]};
                    }
                }
            }

            return Promise.resolve(internalGetStateByRange());
        });

        // KEB HANA BANK
        bank = {
            accounts: [],
            available: true,
            code: 'KOEXKRSEXXX',
            currencyCode: 'KRW',
        };

        bank2 = {
            code: 'SHBKKRSEXXX',
            currencyCode: 'KRW',
            accounts: [],
            available: true,
        };

        bank3 = {
            code: 'OOOOKRSEXXX',
            currencyCode: 'USD',
            accounts: [],
            available: true,
        };

        senderInfo = {
            name: 'Park',
            birthday: Date.now(),
            address: 'sample',
            phoneNumber: 'sample',
        };

        receiverInfo = {
            name: 'Jay',
            birthday: Date.now(),
            address: 'sample',
            phoneNumber: 'sample',
        };

        participants = [
            {
                code: bank.code,
                type: 'sender',
            },
            {
                code: bank2.code,
                type: 'intermediary',
            },
            {
                code: bank3.code,
                type: 'receiver',
            }
        ];
    });

    describe('Test RegisterBank', () => {
        it('should return error on RegisterBank', async () => {
            chaincodeStub.putState.rejects('failed inserting key');

            let remittance = new Remittance();
            try {
                await remittance.RegisterBank(transactionContext, bank.code, bank.currencyCode);
                assert.fail('RegisterBank should have failed');
            } catch(err) {
                expect(err.name).to.equal('failed inserting key');
            }
        });

        it('should return success on RegisterBank', async () => {
            let remittance = new Remittance();

            await remittance.RegisterBank(transactionContext, bank.code, bank.currencyCode);

            let ret = JSON.parse((await chaincodeStub.getState(`bank:${bank.code}`)).toString());
            expect(ret).to.eql(bank);
        });
    });

    describe('Test ReadBank', () => {
        it('should return error on ReadBank', async () => {
            let remittance = new Remittance();
            await remittance.RegisterBank(transactionContext, bank.code, bank.currencyCode);

            try {
                await remittance.ReadBank(transactionContext, 'bank2');
                assert.fail('ReadBank should have failed');
            } catch (err) {
                expect(err.message).to.equal('The asset bank2 does not exist');
            }
        });

        it('should return success on ReadBank', async () => {
            let remittance = new Remittance();
            await remittance.RegisterBank(transactionContext, bank.code, bank.currencyCode);

            let ret = JSON.parse(await chaincodeStub.getState(`bank:${bank.code}`));
            expect(ret).to.eql(bank);
        });
    });

    describe('Test CreateAccount', () => {
        it('should return error on CreateAccount', async () => {
            let remittance = new Remittance();

            await remittance.RegisterBank(transactionContext, bank.code, bank.currencyCode);
            await remittance.RegisterBank(transactionContext, bank2.code, bank2.currencyCode);
            
            try {
                await remittance.CreateAccount(transactionContext, bank.code, bank2.code);
                assert.fail(`The bank ${bank2.code} already exists on ${bank.code}`);
            } catch (err) {
                expect(err.message).to.equal(`The bank ${bank2.code} already exists on ${bank.code}`);
            }
        });

        it('should return success on CreateAccount', async () => {
            let remittance = new Remittance();

            await remittance.RegisterBank(transactionContext, bank.code, bank.currencyCode);
            await remittance.RegisterBank(transactionContext, bank2.code, bank2.currencyCode);

            await remittance.CreateAccount(transactionContext, bank.code, bank2.code);

            let ret = JSON.parse(await chaincodeStub.getState(`bank:${bank.code}`));
            expect(ret.accounts.find(b => b.code = bank2.code).code).to.eql(bank2.code);
        });
    });

    describe('Test ApplyLiquidity', () => {
        it('should return success on ApplyLiquidity', async () => {
            let remittance = new Remittance();

            await remittance.RegisterBank(transactionContext, bank.code, bank.currencyCode);
            await remittance.RegisterBank(transactionContext, bank2.code, bank2.currencyCode);

            await remittance.CreateAccount(transactionContext, bank.code, bank2.code);
            await remittance.ApplyLiquidity(transactionContext, bank.code, bank2.code, 1000);

            let ret = JSON.parse(await chaincodeStub.getState(`bank:${bank.code}`));
            expect(ret.accounts.find(b => b.code = bank2.code).liquidity).to.eql(1000);
        });
    });

    describe('Test ProposeTransaction', () => {
        it('Test Transaction creation', async () => {
            let remittance = new Remittance();

            await remittance.RegisterBank(transactionContext, bank.code, bank.currencyCode);
            await remittance.RegisterBank(transactionContext, bank2.code, bank2.currencyCode);
            await remittance.RegisterBank(transactionContext, bank3.code, bank3.currencyCode);

            await remittance.CreateAccount(transactionContext, bank.code, bank2.code);
            await remittance.CreateAccount(transactionContext, bank2.code, bank3.code);

            await remittance.ApplyLiquidity(transactionContext, bank.code, bank2.code, 1000);
            await remittance.ApplyLiquidity(transactionContext, bank2.code, bank.code, 1000);

            await remittance.ApplyLiquidity(transactionContext, bank2.code, bank3.code, 100);

            // console.log(await remittance.ReadBank(transactionContext, bank.code));
            // console.log(await remittance.ReadBank(transactionContext, bank2.code));
            // console.log(await remittance.ReadBank(transactionContext, bank3.code));

            const id = await remittance.ProposeTransaction(transactionContext, senderInfo, receiverInfo, 1000, participants);
            // console.log(await remittance.ReadTransaction(transactionContext, id));
        });
    });

    //describe('Test UpdateAsset', () => {
    //    it('should return error on UpdateAsset', async () => {
    //        let remittance = new Remittance();
    //        await remittance.CreateAsset(transactionContext, bank.ID, bank.Color, bank.Size, bank.Owner, bank.AppraisedValue);

    //        try {
    //            await remittance.UpdateAsset(transactionContext, 'bank2', 'orange', 10, 'Me', 500);
    //            assert.fail('UpdateAsset should have failed');
    //        } catch (err) {
    //            expect(err.message).to.equal('The bank bank2 does not exist');
    //        }
    //    });

    //    it('should return success on UpdateAsset', async () => {
    //        let remittance = new Remittance();
    //        await remittance.CreateAsset(transactionContext, bank.ID, bank.Color, bank.Size, bank.Owner, bank.AppraisedValue);

    //        await remittance.UpdateAsset(transactionContext, 'bank1', 'orange', 10, 'Me', 500);
    //        let ret = JSON.parse(await chaincodeStub.getState(bank.ID));
    //        let expected = {
    //            ID: 'bank1',
    //            Color: 'orange',
    //            Size: 10,
    //            Owner: 'Me',
    //            AppraisedValue: 500
    //        };
    //        expect(ret).to.eql(expected);
    //    });
    //});

    //describe('Test DeleteAsset', () => {
    //    it('should return error on DeleteAsset', async () => {
    //        let remittance = new Remittance();
    //        await remittance.CreateAsset(transactionContext, bank.ID, bank.Color, bank.Size, bank.Owner, bank.AppraisedValue);

    //        try {
    //            await remittance.DeleteAsset(transactionContext, 'bank2');
    //            assert.fail('DeleteAsset should have failed');
    //        } catch (err) {
    //            expect(err.message).to.equal('The bank bank2 does not exist');
    //        }
    //    });

    //    it('should return success on DeleteAsset', async () => {
    //        let remittance = new Remittance();
    //        await remittance.CreateAsset(transactionContext, bank.ID, bank.Color, bank.Size, bank.Owner, bank.AppraisedValue);

    //        await remittance.DeleteAsset(transactionContext, bank.ID);
    //        let ret = await chaincodeStub.getState(bank.ID);
    //        expect(ret).to.equal(undefined);
    //    });
    //});

    //describe('Test TransferAsset', () => {
    //    it('should return error on TransferAsset', async () => {
    //        let remittance = new Remittance();
    //        await remittance.CreateAsset(transactionContext, bank.ID, bank.Color, bank.Size, bank.Owner, bank.AppraisedValue);

    //        try {
    //            await remittance.TransferAsset(transactionContext, 'bank2', 'Me');
    //            assert.fail('DeleteAsset should have failed');
    //        } catch (err) {
    //            expect(err.message).to.equal('The bank bank2 does not exist');
    //        }
    //    });

    //    it('should return success on TransferAsset', async () => {
    //        let remittance = new Remittance();
    //        await remittance.CreateAsset(transactionContext, bank.ID, bank.Color, bank.Size, bank.Owner, bank.AppraisedValue);

    //        await remittance.TransferAsset(transactionContext, bank.ID, 'Me');
    //        let ret = JSON.parse((await chaincodeStub.getState(bank.ID)).toString());
    //        expect(ret).to.eql(Object.assign({}, bank, {Owner: 'Me'}));
    //    });
    //});

//    describe('Test GetAllAssets', () => {
//        it('should return success on GetAllAssets', async () => {
//            let remittance = new Remittance();
//
//            await remittance.CreateAsset(transactionContext, 'bank1', 'blue', 5, 'Robert', 100);
//            await remittance.CreateAsset(transactionContext, 'bank2', 'orange', 10, 'Paul', 200);
//            await remittance.CreateAsset(transactionContext, 'bank3', 'red', 15, 'Troy', 300);
//            await remittance.CreateAsset(transactionContext, 'bank4', 'pink', 20, 'Van', 400);
//
//            let ret = await remittance.GetAllAssets(transactionContext);
//            ret = JSON.parse(ret);
//            expect(ret.length).to.equal(4);
//
//            let expected = [
//                {Record: {ID: 'bank1', Color: 'blue', Size: 5, Owner: 'Robert', AppraisedValue: 100}},
//                {Record: {ID: 'bank2', Color: 'orange', Size: 10, Owner: 'Paul', AppraisedValue: 200}},
//                {Record: {ID: 'bank3', Color: 'red', Size: 15, Owner: 'Troy', AppraisedValue: 300}},
//                {Record: {ID: 'bank4', Color: 'pink', Size: 20, Owner: 'Van', AppraisedValue: 400}}
//            ];
//
//            expect(ret).to.eql(expected);
//        });
//
//        it('should return success on GetAllAssets for non JSON value', async () => {
//            let remittance = new Remittance();
//
//            chaincodeStub.putState.onFirstCall().callsFake((key, value) => {
//                if (!chaincodeStub.states) {
//                    chaincodeStub.states = {};
//                }
//                chaincodeStub.states[key] = 'non-json-value';
//            });
//
//            await remittance.CreateAsset(transactionContext, 'bank1', 'blue', 5, 'Robert', 100);
//            await remittance.CreateAsset(transactionContext, 'bank2', 'orange', 10, 'Paul', 200);
//            await remittance.CreateAsset(transactionContext, 'bank3', 'red', 15, 'Troy', 300);
//            await remittance.CreateAsset(transactionContext, 'bank4', 'pink', 20, 'Van', 400);
//
//            let ret = await remittance.GetAllAssets(transactionContext);
//            ret = JSON.parse(ret);
//            expect(ret.length).to.equal(4);
//
//            let expected = [
//                {Record: 'non-json-value'},
//                {Record: {ID: 'bank2', Color: 'orange', Size: 10, Owner: 'Paul', AppraisedValue: 200}},
//                {Record: {ID: 'bank3', Color: 'red', Size: 15, Owner: 'Troy', AppraisedValue: 300}},
//                {Record: {ID: 'bank4', Color: 'pink', Size: 20, Owner: 'Van', AppraisedValue: 400}}
//            ];
//
//            expect(ret).to.eql(expected);
//        });
//    });
});
