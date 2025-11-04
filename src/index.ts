import * as core from '@actions/core';
import { run } from './action/run';

try {
    await run();
} catch (e) {
    core.setFailed(e instanceof Error ? e : String(e));
    console.error(e);
}
