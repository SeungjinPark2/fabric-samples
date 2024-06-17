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
const { ChaincodeStub, ClientIdentity, newLogger } = require('fabric-shim');

const Remittance = require('../lib/remittance.js');

let assert = sinon.assert;
chai.use(sinonChai);

describe('Remittance Tests', () => {
    let transactionContext;
    let chaincodeStub;
    let sandbox;
    let clientIdentity;
    let remittance;
    let bank;
    let bank2;
    let bank3;
    let senderInfo;
    let receiverInfo;
    let participants;

    beforeEach(async () => {
        transactionContext = new Context();

        sandbox = sinon.createSandbox();
        chaincodeStub = sinon.createStubInstance(ChaincodeStub);
        clientIdentity =  sandbox.createStubInstance(ClientIdentity);
        transactionContext.setChaincodeStub(chaincodeStub);
        transactionContext.setClientIdentity(clientIdentity);
        remittance = new Remittance();

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
            currencyCode: 'JPY',
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
                code: bank2.code,
                type: 'intermediary',
            },
            {
                code: bank3.code,
                type: 'receiver',
            }
        ];

        const metadata = {
            apiToken: 'fxr_live_b1e7580ba98491842a59797583c3d681e5af',
            apiEndpoint: 'https://api.fxratesapi.com/',
            participantTypes: ['sender', 'intermediary', 'receiver'],
        };

        clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns('admin');
        await remittance.Init(transactionContext, metadata.apiEndpoint, metadata.apiEndpoint, metadata.participantTypes);
    });

    describe('Test RegisterBank', () => {
        it('should return error on RegisterBank', async () => {
            chaincodeStub.putState.rejects('failed inserting key');

            try {
                await remittance.RegisterBank(transactionContext, bank.code, bank.currencyCode);
                assert.fail('RegisterBank should have failed');
            } catch(err) {
                expect(err.name).to.equal('failed inserting key');
            }
        });

        it('should return success on RegisterBank', async () => {
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
            await remittance.RegisterBank(transactionContext, bank.currencyCode);

            let ret = JSON.parse((await chaincodeStub.getState(`bank:${bank.code}`)).toString());
            expect(ret).to.eql(bank);
        });
    });

    describe('Test ReadBank', () => {
        it('should return error on ReadBank', async () => {
            try {
                await remittance.ReadBank(transactionContext, 'bank2');
                assert.fail('ReadBank should have failed');
            } catch (err) {
                expect(err.message).to.equal('The asset bank2 does not exist');
            }
        });

        it('should return success on ReadBank', async () => {
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
            await remittance.RegisterBank(transactionContext, bank.currencyCode);

            let ret = JSON.parse(await remittance.ReadBank(transactionContext, bank.code));
            expect(ret).to.eql(bank);
        });
    });

    describe('Test ReadBank', () => {
        it('should return error on ReadBank', async () => {
            try {
                await remittance.ReadBank(transactionContext, 'bank2');
                assert.fail('ReadBank should have failed');
            } catch (err) {
                expect(err.message).to.equal('The asset bank2 does not exist');
            }
        });
    });

    describe('Test CreateAccount', () => {
        it('should return error on CreateAccount', async () => {
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank2.code);
            await remittance.RegisterBank(transactionContext, bank2.currencyCode);
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
            await remittance.RegisterBank(transactionContext, bank.currencyCode);
            
            try {
                await remittance.CreateAccount(transactionContext, bank2.code);
                assert.fail(`The bank ${bank2.code} already exists on ${bank.code}`);
            } catch (err) {
                expect(err.message).to.equal(`The bank ${bank2.code} already exists on ${bank.code}`);
            }
        });

        it('should return success on CreateAccount', async () => {
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank2.code);
            await remittance.RegisterBank(transactionContext, bank2.currencyCode);
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
            await remittance.RegisterBank(transactionContext, bank.currencyCode);

            await remittance.CreateAccount(transactionContext, bank2.code);

            let ret = JSON.parse(await chaincodeStub.getState(`bank:${bank.code}`));
            expect(ret.accounts.find(b => b.code = bank2.code).code).to.eql(bank2.code);
        });
    });

    describe('Test ApplyLiquidity', () => {
        it('should return success on ApplyLiquidity', async () => {
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank2.code);
            await remittance.RegisterBank(transactionContext, bank2.currencyCode);
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
            await remittance.RegisterBank(transactionContext, bank.currencyCode);


            await remittance.CreateAccount(transactionContext, bank2.code);
            await remittance.ApplyLiquidity(transactionContext, bank2.code, 1000);

            let ret = JSON.parse(await chaincodeStub.getState(`bank:${bank.code}`));
            expect(ret.accounts.find(b => b.code = bank2.code).liquidity).to.eql('1000');
        });
    });

    describe('Test Transaction', () => {
        async function registrationSetup() {
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
            await remittance.RegisterBank(transactionContext, bank.currencyCode);
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank2.code);
            await remittance.RegisterBank(transactionContext, bank2.currencyCode);
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank3.code);
            await remittance.RegisterBank(transactionContext, bank3.currencyCode);
        }

        async function liquiditySetup() {
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
            await remittance.CreateAccount(transactionContext, bank2.code);
            await remittance.ApplyLiquidity(transactionContext, bank2.code, 100000);

            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank2.code);
            await remittance.CreateAccount(transactionContext, bank.code);
            await remittance.ApplyLiquidity(transactionContext, bank.code, 100000);

            await remittance.CreateAccount(transactionContext, bank3.code);
            await remittance.ApplyLiquidity(transactionContext, bank3.code, 100000);

            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank3.code);
            await remittance.CreateAccount(transactionContext, bank2.code);
            await remittance.ApplyLiquidity(transactionContext, bank2.code, 1000);

        }

        it('Test Transaction creation', async () => {
            await registrationSetup();
            await liquiditySetup();

            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
            const ret = await remittance.ProposeTransaction(transactionContext, senderInfo, receiverInfo, 1000, participants);
            console.dir(JSON.parse(ret), { depth: null });

            const receipts = await remittance.ReadReceipt(transactionContext, JSON.parse(ret).id);
            console.log(receipts);
        });

        it('Test Transaction creation fail', async () => {
            await registrationSetup();

            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
            await remittance.CreateAccount(transactionContext, bank2.code);
            await remittance.ApplyLiquidity(transactionContext, bank2.code, 100000);

            // bank2 는 bank1 을 hold 하지만 bank3 을 hold 하지 않는다고 가정
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank2.code);
            await remittance.CreateAccount(transactionContext, bank.code);
            await remittance.ApplyLiquidity(transactionContext, bank.code, 100000);

            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank3.code);
            await remittance.CreateAccount(transactionContext, bank2.code);
            await remittance.ApplyLiquidity(transactionContext, bank2.code, 1000);

            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
            
            try {
                await remittance.ProposeTransaction(transactionContext, senderInfo, receiverInfo, 1000, participants);
                assert.fail(`The bank ${bank3.code} does not exists on ${bank2.code}`);
            } catch (err) {
                expect(err.message).to.equal(`The bank ${bank3.code} does not exists on ${bank2.code}`);
            }
        });

        it('Test ApproveTransaction', async () => {
            await registrationSetup();
            await liquiditySetup();

            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
            const ret = JSON.parse(await remittance.ProposeTransaction(transactionContext, senderInfo, receiverInfo, 1000, participants));

            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank2.code);
            const approvedTxFromBank2 = JSON.parse(await remittance.ApproveTransaction(transactionContext, ret.id, 'approve'));
            const foundBank2 = approvedTxFromBank2.participants.find(p => p.code === bank2.code);
            expect(foundBank2.approved).to.equal(true);

            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank3.code);
            const approvedTxFromBank3 = JSON.parse(await remittance.ApproveTransaction(transactionContext, ret.id, 'approve'));
            const foundBank3 = approvedTxFromBank3.participants.find(p => p.code === bank3.code);
            expect(foundBank3.approved).to.equal(true);
            expect(approvedTxFromBank3.status).to.equal('done');

            const fBank1 = JSON.parse(await remittance.ReadBank(transactionContext, bank.code));
            const fBank2 = JSON.parse(await remittance.ReadBank(transactionContext, bank2.code));
            const fBank3 = JSON.parse(await remittance.ReadBank(transactionContext, bank3.code));

            console.log(fBank1.accounts);
            console.log(fBank2.accounts);
            console.log(fBank3.accounts);
        });
    });

    describe('Init', () => {
        it('should execute for admin users', async () => {
            clientIdentity.getMSPID.returns('Org1MSP');
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns('admin');

            const response = JSON.parse(await remittance.Init(transactionContext, 'testtoken'));
            expect(response.fxRateApiToken).to.equal('testtoken');
        });

        it('should throw an error for non-admin users', async () => {
            clientIdentity.getMSPID.returns('Org1MSP');
            clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns('user');

            try {
                await remittance.Init(transactionContext, 'testtoken');
                expect.fail('Init should throw an error for non-admin users');
            } catch (err) {
                expect(err.message).to.equal('This function is restricted to admin users');
            }
        });
    });
});
