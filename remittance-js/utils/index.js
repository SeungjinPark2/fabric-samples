// fetched state to JSON data
const stateParser = (state) => {
    return JSON.parse(state.toString());
};

module.exports = { stateParser };
