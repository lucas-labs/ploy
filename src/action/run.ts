import * as env from '@actions/github';

export const run = async (): Promise<void> => {
    console.log('Ref:', env.context.ref);
    console.log('SHA:', env.context.sha);
    console.log('Event:', env.context.eventName);
    console.log('Repo:', env.context.repo);

    console.log(env.context);

    // log the same but accessing env variables directly
    console.log('GITHUB_REF:', process.env.GITHUB_REF);
    console.log('GITHUB_SHA:', process.env.GITHUB_SHA);
    console.log('GITHUB_EVENT_NAME:', process.env.GITHUB_EVENT_NAME);
    console.log('GITHUB_REPOSITORY:', process.env.GITHUB_REPOSITORY);

    // log the entire env
    console.log('Entire ENV:', process.env);
};
