const { default: axios } = require('axios');

const getFxRate = async (metadata, base, target) => {
    if (base === target) {
        return 1;
    }

    const { data } = await axios.get(
        `${metadata.apiEndpoint}/latest?base=${base}&currencies=${target}&resolution=1m&amount=1&places=6&format=json&api_key=${metadata.apiToken}`
    );

    return data.rates[target];
};

module.exports = { getFxRate };
