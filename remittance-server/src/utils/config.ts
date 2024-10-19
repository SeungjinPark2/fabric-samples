import path from 'path';

export const getConfiguration = () => {
    const port = parseInt(process.env.PORT || '3000');
    const channelName = process.env.CHANNEL_NAME || '';
    const chaincodeName = process.env.CHAINCODE_NAME || '';
    const orgNum = parseInt(process.env.ORGNUM || '0');
    const userId = process.env.USERID || '';
    const mspOrg = `Org${orgNum}MSP`;
    const walletPath = path.join(__dirname, '..', 'wallet', `org${orgNum}`);

    console.log(`
        ----------------- env variables -----------------
        port: ${port}
        channelName: ${channelName}
        chaincodeName: ${chaincodeName}
        orgNum: ${orgNum}
        userId: ${userId}
        mspOrg: ${mspOrg}
        walletPath: ${walletPath}
        ----------------- env variables -----------------
        `);

    return {
        port,
        channelName,
        chaincodeName,
        orgNum,
        userId,
        mspOrg,
        walletPath,
    };
};
