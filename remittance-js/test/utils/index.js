const fakeChaincodeStub = (chaincodeStub) => {
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
};

const prank = (clientIdentity, code) => {
    clientIdentity.getAttributeValue.withArgs('hf.EnrollmentID').returns(code);
};

const metadata = {
    apiToken: process.env.TOKEN,
    apiEndpoint: process.env.ENDPOINT,
    fee: process.env.FEE,
};

module.exports = { fakeChaincodeStub, prank, metadata };
