import { getAzureService } from './azureServices';
import { convertToGitBranchName, createReleaseBranchName, mapJsonToRepository, trimBranchName } from '../util/util';

/**
 * @param {Repository} repo
 * @param {string} sourceBranch
 * @param {string} targetBranch
 */
export async function tryToCreatePr(repo, sourceBranch, targetBranch) {
    const azureService = getAzureService();
    const diffResult = await azureService.getBranchDiff(repo, targetBranch, sourceBranch);

    if (!diffResult.changes || diffResult.changes.length == 0) {
        return { message: `${repo.name} : no changes between ${sourceBranch} and ${targetBranch}.`, success: true };
    }

    const title = `Merge ${sourceBranch}`;
    const desc = `Merging ${sourceBranch} into ${targetBranch}`;
    const srcB = convertToGitBranchName(sourceBranch);
    const tarB = convertToGitBranchName(targetBranch);
    const result = await azureService.postPullRequest(repo, srcB, tarB, title, desc, []);

    const successMsg = `${repo.name} : Created a PR that merges ${sourceBranch} into ${targetBranch}.`;
    const failMsg = `${repo.name} : Failed to create PR.`;

    const success = result.mergeStatus === 'queued';
    const message = success ? successMsg : failMsg;

    return { message: message, success: success };
}

/**
 * @param {Date} releaseDate
 * @param {Repository} repo
 */
export async function createReleaseBranch(releaseDate, repo) {
    const azureService = getAzureService();
    const branchName = trimBranchName(repo.defaultBranch);
    const defaultBranchInfo = await azureService.fetchBranchInfo(repo, '/' + branchName);
    const releaseBranch = createReleaseBranchName(releaseDate);
    const gitBranchname = convertToGitBranchName(releaseBranch);
    const branch = defaultBranchInfo.value.filter(el => trimBranchName(el.name) === branchName);
    if (branch.length === 0) {
        return {
            success: false,
            message: `Could not find branch with name ${branchName} from the repository ${repo.name}`
        }
    }

    const postResult = await azureService.postNewReleaseBranch(repo, gitBranchname, branch[0].objectId);
    const success = postResult.value.length > 0 && postResult.value[0].success;
    const message = `${repo.name}: ${!success ? 'Failed to create' : 'Created'} ${releaseBranch} from ${repo.defaultBranch}`
    return {
        success: success,
        message: message
    };
}

export async function loadRepositories(config) {
    let results = [];
    const azureService = getAzureService();
    for (const orgTeam of config.ORG_PROJECTS) {
        const jason = await azureService.fetchRepositories(orgTeam.ORGANIZATION, orgTeam.PROJECT);
        results = results.concat(jason.value.map(el => {
            return {
                repo: el,
                org: orgTeam.ORGANIZATION,
                proj: orgTeam.PROJECT
            }
        }));
    }

    results.sort((a, b) => a.repo.name.localeCompare(b.repo.name));
    return results.map((el, i) => mapJsonToRepository(el.repo, el.org, el.proj, i));
}

export async function findReposWithRelBranches(date, config) {
    const azureService = getAzureService();
    const relBranchName = createReleaseBranchName(date);
    const reposToCheck = await loadRepositories(config);

    const branchInfos = [];
    reposToCheck.forEach(repo => branchInfos.push(azureService.fetchBranchInfo(repo, relBranchName)
        .then(jason => {
            return {
                repo: repo,
                jason: jason
            };
        })));

    return Promise.all(branchInfos).then(resp =>
        resp
        .filter(bInfo => bInfo.jason.count > 0)
        .map(bInfo => bInfo.repo)
    );
}