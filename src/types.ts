export interface ActionInputs {
    appName: string;
    deployRoot: string;
    repoPath: string;
    mode: string;
    installCmds?: string[];
    buildCmds?: string[];
    distDir?: string;
    preDeployCmds?: string[];
    postDeployCmds?: string[];
    healthcheckUrl?: string;
    expectedHealthcheckCodeRange: string;
    healthcheckTimeout: number;
    healthcheckRetries: number;
    healthcheckDelay: number;
    healthcheckInterval: number;
}

export interface ActionOutputs {
    releasePath?: string;
    releaseId?: string;
    previousRelease?: string;
    deploymentTime?: string;
    healthcheckStatus?: string;
    healthcheckCode?: number;
    healthcheckAttempts?: number;
    currentJunction?: string;
    elapsed?: number;
}

export interface Context {
    inputs: ActionInputs;
    outputs: ActionOutputs;
}

export interface HealthCheckResult {
    success: boolean;
    statusCode?: number;
    attempts: number;
    error?: string;
}

export interface ReleaseInfo {
    releaseId: string;
    releasePath: string;
    timestamp: string;
    sha: string;
}

export interface Step {
    moji: string;
    description: string;
    run: (inputs: Context) => Promise<any>;
}

export interface Mode {
    name: string;
    description: string;
    steps: Step[];
}
