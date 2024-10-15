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
const sortKeysRecursive = require('sort-keys-recursive');

let assert = sinon.assert;
chai.use(sinonChai);

describe('Remittance Tests', () => {
    // TEST vars
    let transactionContext;
    let chaincodeStub;
    let clientIdentity;
    let remittance;

    // COMMON vars
    const bank1 = sortKeysRecursive({
        code: 'DEMOBANK1',
        currencyCode: 'KRW',
        accounts: [],
    });

    const bank2 = sortKeysRecursive({
        code: 'DEMOBANK2',
        currencyCode: 'JPY',
        accounts: [],
    });

    const bank3 = sortKeysRecursive({
        code: 'DEMOBANK3',
        currencyCode: 'USD',
        accounts: [],
    });

    let senderInfo;
    let receiverInfo;
    let participants;

    const metadata = {
        apiToken: process.env.TOKEN,
        apiEndpoint: process.env.ENDPOINT,
    };

    // reusable functions
    // reusable functions

    before(async () => {
        transactionContext = new Context();

        chaincodeStub = sinon.createStubInstance(ChaincodeStub);
        clientIdentity = sinon.createStubInstance(ClientIdentity);
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
                        yield { value: copied[key] };
                    }
                }
            }

            return Promise.resolve(internalGetStateByRange());
        });

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
            },
        ];

        clientIdentity.getAttributeValue
            .withArgs('hf.EnrollmentID')
            .returns('admin');

        await remittance.Init(
            transactionContext,
            metadata.apiToken,
            metadata.apiEndpoint
        );
    });

    describe('Init', () => {
        it('should save proper data', async () => {
            const getStateResult = await chaincodeStub.getState('metadata');
            const fMetadata = stateParser(getStateResult);
            expect(fMetadata).eql(metadata);
        });
    });

    describe('RegisterBank', () => {
        it('should return registered bank object', async () => {
            clientIdentity.getAttributeValue
                .withArgs('hf.EnrollmentID')
                .returns(bank1.code);

            const registeredBank = await remittance.RegisterBank(
                transactionContext,
                bank1.currencyCode
            );

            expect(registeredBank).eql(bank1);
        });

        it('should fail because of conflict', async () => {
            clientIdentity.getAttributeValue
                .withArgs('hf.EnrollmentID')
                .returns(bank1.code);

            try {
                await remittance.RegisterBank(
                    transactionContext,
                    bank1.currencyCode
                );
            } catch (error) {
                expect(error.message).to.equal(
                    `The bank ${bank1.code} already exists`
                );
            }
        });
    });

    // describe('Test ReadBank', () => {
    //     it('should return error on ReadBank', async () => {
    //         try {
    //             await remittance.ReadBank(transactionContext, 'bank2');
    //             assert.fail('ReadBank should have failed');
    //         } catch (err) {
    //             expect(err.message).to.equal('The asset bank2 does not exist');
    //         }
    //     });

    //     it('should return success on ReadBank', async () => {
    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
    //         await remittance.RegisterBank(transactionContext, bank.currencyCode);

    //         let ret = JSON.parse(await remittance.ReadBank(transactionContext, bank.code));
    //         expect(ret).to.eql(bank);
    //     });
    // });

    // describe('Test ReadBank', () => {
    //     it('should return error on ReadBank', async () => {
    //         try {
    //             await remittance.ReadBank(transactionContext, 'bank2');
    //             assert.fail('ReadBank should have failed');
    //         } catch (err) {
    //             expect(err.message).to.equal('The asset bank2 does not exist');
    //         }
    //     });
    // });

    // describe('Test CreateAccount', () => {
    //     it('should return error on CreateAccount', async () => {
    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank2.code);
    //         await remittance.RegisterBank(transactionContext, bank2.currencyCode);
    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
    //         await remittance.RegisterBank(transactionContext, bank.currencyCode);

    //         try {
    //             await remittance.CreateAccount(transactionContext, bank2.code);
    //             assert.fail(`The bank ${bank2.code} already exists on ${bank.code}`);
    //         } catch (err) {
    //             expect(err.message).to.equal(`The bank ${bank2.code} already exists on ${bank.code}`);
    //         }
    //     });

    //     it('should return success on CreateAccount', async () => {
    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank2.code);
    //         await remittance.RegisterBank(transactionContext, bank2.currencyCode);
    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
    //         await remittance.RegisterBank(transactionContext, bank.currencyCode);

    //         await remittance.CreateAccount(transactionContext, bank2.code);

    //         let ret = JSON.parse(await chaincodeStub.getState(`bank:${bank.code}`));
    //         expect(ret.accounts.find(b => b.code = bank2.code).code).to.eql(bank2.code);
    //     });
    // });

    // describe('Test ApplyLiquidity', () => {
    //     it('should return success on ApplyLiquidity', async () => {
    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank2.code);
    //         await remittance.RegisterBank(transactionContext, bank2.currencyCode);
    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
    //         await remittance.RegisterBank(transactionContext, bank.currencyCode);

    //         await remittance.CreateAccount(transactionContext, bank2.code);
    //         await remittance.ApplyLiquidity(transactionContext, bank2.code, 1000);

    //         let ret = JSON.parse(await chaincodeStub.getState(`bank:${bank.code}`));
    //         expect(ret.accounts.find(b => b.code = bank2.code).liquidity).to.eql('1000');
    //     });
    // });

    // describe('Test Transaction', () => {
    //     async function registrationSetup() {
    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
    //         await remittance.RegisterBank(transactionContext, bank.currencyCode);
    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank2.code);
    //         await remittance.RegisterBank(transactionContext, bank2.currencyCode);
    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank3.code);
    //         await remittance.RegisterBank(transactionContext, bank3.currencyCode);
    //     }

    //     async function liquiditySetup() {
    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
    //         await remittance.CreateAccount(transactionContext, bank2.code);
    //         await remittance.ApplyLiquidity(transactionContext, bank2.code, 100000);

    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank2.code);
    //         await remittance.CreateAccount(transactionContext, bank.code);
    //         await remittance.ApplyLiquidity(transactionContext, bank.code, 100000);

    //         await remittance.CreateAccount(transactionContext, bank3.code);
    //         await remittance.ApplyLiquidity(transactionContext, bank3.code, 100000);

    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank3.code);
    //         await remittance.CreateAccount(transactionContext, bank2.code);
    //         await remittance.ApplyLiquidity(transactionContext, bank2.code, 1000);

    //     }

    //     it('Test Transaction creation', async () => {
    //         await registrationSetup();
    //         await liquiditySetup();

    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
    //         const ret = await remittance.ProposeTransaction(transactionContext, JSON.stringify(senderInfo), JSON.stringify(receiverInfo), 1000, JSON.stringify(participants));
    //         console.dir(JSON.parse(ret), { depth: null });

    //         const receipts = await remittance.ReadReceipt(transactionContext, JSON.parse(ret).id);
    //         console.log(receipts);
    //     });

    //     it('Test Transaction creation fail', async () => {
    //         await registrationSetup();

    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
    //         await remittance.CreateAccount(transactionContext, bank2.code);
    //         await remittance.ApplyLiquidity(transactionContext, bank2.code, 100000);

    //         // bank2 는 bank1 을 hold 하지만 bank3 을 hold 하지 않는다고 가정
    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank2.code);
    //         await remittance.CreateAccount(transactionContext, bank.code);
    //         await remittance.ApplyLiquidity(transactionContext, bank.code, 100000);

    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank3.code);
    //         await remittance.CreateAccount(transactionContext, bank2.code);
    //         await remittance.ApplyLiquidity(transactionContext, bank2.code, 1000);

    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);

    //         try {
    //             await remittance.ProposeTransaction(transactionContext, JSON.stringify(senderInfo), JSON.stringify(receiverInfo), 1000, JSON.stringify(participants));
    //             assert.fail(`The bank ${bank3.code} does not exists on ${bank2.code}`);
    //         } catch (err) {
    //             expect(err.message).to.equal(`The bank ${bank3.code} does not exists on ${bank2.code}`);
    //         }
    //     });

    //     it('Test ApproveTransaction', async () => {
    //         await registrationSetup();
    //         await liquiditySetup();

    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank.code);
    //         const ret = JSON.parse(await remittance.ProposeTransaction(transactionContext, JSON.stringify(senderInfo), JSON.stringify(receiverInfo), 1000, JSON.stringify(participants)));

    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank2.code);
    //         const approvedTxFromBank2 = JSON.parse(await remittance.ApproveTransaction(transactionContext, ret.id, 'approve'));
    //         const foundBank2 = approvedTxFromBank2.participants.find(p => p.code === bank2.code);
    //         expect(foundBank2.approved).to.equal(true);

    //         clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(bank3.code);
    //         const approvedTxFromBank3 = JSON.parse(await remittance.ApproveTransaction(transactionContext, ret.id, 'approve'));
    //         const foundBank3 = approvedTxFromBank3.participants.find(p => p.code === bank3.code);
    //         expect(foundBank3.approved).to.equal(true);
    //         expect(approvedTxFromBank3.status).to.equal('done');

    //         const fBank1 = JSON.parse(await remittance.ReadBank(transactionContext, bank.code));
    //         const fBank2 = JSON.parse(await remittance.ReadBank(transactionContext, bank2.code));
    //         const fBank3 = JSON.parse(await remittance.ReadBank(transactionContext, bank3.code));

    //         console.log(fBank1.accounts);
    //         console.log(fBank2.accounts);
    //         console.log(fBank3.accounts);
    //     });
    // });
});

// fetched state to JSON data
const stateParser = (state) => {
    return JSON.parse(state.toString());
};
