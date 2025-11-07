import type { Mode } from '@/types';
import buildStep from '../steps/common/build.step';
import copyFilesStep from '../steps/common/copy-files.step';
import envSetupStep from '../steps/common/env-setup.step';
import healthcheckStep from '../steps/common/healthcheck.step';
import installDepsStep from '../steps/common/install-deps.step';
import postDeployCmdsStep from '../steps/common/post-deploy-cmds.step';
import preDeployCmdsStep from '../steps/common/pre-deploy-cmds.step';
import prepareReleaseDirStep from '../steps/common/prepare-release-dir.step';
import switchActiveReleaseStep from '../steps/common/switch-active-release.step';

/** Default deployment mode; for when mode is set to 'default' or not specified. */
export default {
    name: 'default',
    description: 'Default deployment mode',
    steps: [
        envSetupStep,
        installDepsStep,
        buildStep,
        prepareReleaseDirStep,
        copyFilesStep,
        preDeployCmdsStep,
        switchActiveReleaseStep,
        postDeployCmdsStep,
        healthcheckStep,
    ],
} satisfies Mode;
