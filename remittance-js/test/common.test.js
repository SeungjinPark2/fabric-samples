'use strict';
const sinon = require('sinon');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const { describe, before, it } = require('mocha');
const expect = chai.expect;

const { Context } = require('fabric-contract-api');
const { ChaincodeStub, ClientIdentity } = require('fabric-shim');

const Remittance = require('../lib/remittance.js');
const { stateParser } = require('../utils/index.js');
const { banks } = require('./utils/mock.json');
const { fakeChaincodeStub, prank, metadata } = require('./utils/index.js');
chai.use(sinonChai);

describe('Remittance Tests', () => {
    // TEST vars
    let transactionContext;
    let chaincodeStub;
    let clientIdentity;
    let remittance;

    before(async () => {
        transactionContext = new Context();

        chaincodeStub = sinon.createStubInstance(ChaincodeStub);
        clientIdentity = sinon.createStubInstance(ClientIdentity);
        transactionContext.setChaincodeStub(chaincodeStub);
        transactionContext.setClientIdentity(clientIdentity);
        remittance = new Remittance();

        fakeChaincodeStub(chaincodeStub);

        await remittance.Init(
            transactionContext,
            metadata.apiToken,
            metadata.apiEndpoint,
            metadata.fee
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
            prank(clientIdentity, banks[0].code);

            const registeredBank = await remittance.RegisterBank(
                transactionContext,
                banks[0].currencyCode
            );

            expect(registeredBank).eql(banks[0]);
        });

        it('should fail because of conflict', async () => {
            try {
                await remittance.RegisterBank(
                    transactionContext,
                    banks[0].currencyCode
                );
            } catch (error) {
                expect(error.message).to.equal(
                    `The bank ${banks[0].code} already exists`
                );
            }
        });
    });

    describe('ReadBank', () => {
        it('should arise error', async () => {
            try {
                await remittance.ReadBank(transactionContext, banks[1].code);
            } catch (err) {
                expect(err.message).to.equal(
                    `The bank ${banks[1].code} does not exist`
                );
            }
        });

        it('should succeed', async () => {
            let ret = stateParser(
                await remittance.ReadBank(transactionContext, banks[0].code)
            );

            expect(ret).to.eql(banks[0]);
        });
    });

    describe('CreateAccount', () => {
        it('should return success on CreateAccount', async () => {
            prank(clientIdentity, banks[1].code);
            await remittance.RegisterBank(
                transactionContext,
                banks[1].currencyCode
            );

            prank(clientIdentity, banks[0].code);
            await remittance.CreateAccount(transactionContext, banks[1].code);

            let ret = stateParser(
                await chaincodeStub.getState(`bank:${banks[0].code}`)
            );

            expect(ret.correspondentBanks.find((b) => b === banks[1].code)).not
                .to.be.undefined;
        });

        it('should arise error', async () => {
            try {
                await remittance.CreateAccount(
                    transactionContext,
                    banks[1].code
                );
            } catch (err) {
                expect(err.message).to.equal(
                    `The bank ${banks[1].code} already exists on ${banks[0].code}`
                );
            }
        });
    });
});
