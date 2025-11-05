export interface ActionInputs {
    appName: string;
    deployRoot: string;
    repoPath: string;
    installCmds?: string[];
    buildCmds?: string[];
    distDir?: string;
    preDeployCmds?: string[];
    healthcheckUrl?: string;
    expectedHealthcheckCodeRange: string;
    healthcheckTimeout: number;
    healthcheckRetries: number;
    healthcheckDelay: number;
    healthcheckInterval: number;
}

export interface ActionOutputs {
    releasePath: string;
    releaseId: string;
    previousRelease?: string;
    deploymentTime: string;
    healthcheckStatus?: string;
    healthcheckCode?: number;
    healthcheckAttempts?: number;
    currentJunction: string;
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
