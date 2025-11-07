import * as core from '@actions/core';
import modes from './modes';
import steps from './steps';
import { getInputs, setOutputs } from '@/utils/context';

/** main entry point for the action */
export const run = async (): Promise<void> => {
    const inputs = getInputs();
    const mode = modes.get(inputs.mode);

    const outputs = await steps.execute(mode.steps, inputs);
    setOutputs(outputs);

    core.info('🎉 Deployment completed successfully!');
};
