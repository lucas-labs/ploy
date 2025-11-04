import * as core from '@actions/core';
import { deployAction } from './subactions/deploy/action';
import { getInputs, setOutputs } from './utils/context';

/** main entry point for the action */
export const run = async (): Promise<void> => {
    // Parse inputs
    const inputs = getInputs();

    // Execute deployment
    const outputs = await deployAction(inputs);

    // Set outputs
    setOutputs(outputs);

    core.info('🎉 Deployment completed successfully!');
};
