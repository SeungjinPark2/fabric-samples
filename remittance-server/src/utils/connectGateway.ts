import { GatewayOptions } from 'fabric-network';
import { configuration } from './config';

export const connectGateway = async (
    ccp: Record<string, any>,
    gatewayOpts: GatewayOptions,
    channelName: string,
    chaincodeName: string
) => {
    await configuration.gateway.connect(ccp, gatewayOpts);
    configuration.network = await configuration.gateway.getNetwork(channelName);
    configuration.contract = configuration.network.getContract(chaincodeName);
};
