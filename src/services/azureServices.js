const APIS = {
    listRepos: (org, project) => `https://dev.azure.com/${org}/${project}/_apis/git/repositories?api-version=7.0`,
    createRef: repo => `https://dev.azure.com/${repo.org}/${repo.project}/_apis/git/repositories/${repo.adoId}/refs?api-version=7.0`,
    retrieveRef: (repo, filter) => `https://dev.azure.com/${repo.org}/${repo.project}/_apis/git/repositories/${repo.adoId}/refs?api-version=7.0&filterContains=${encodeURIComponent(filter)}`,
    getBranchDiff: (repo, bBranch, tBranch) => `https://dev.azure.com/${repo.org}/${repo.project}/_apis/git/repositories/${repo.adoId}/diffs/commits?api-version=7.0&baseVersion=${bBranch}&targetVersion=${tBranch}`,
    createPr: repo => `https://dev.azure.com/${repo.org}/${repo.project}/_apis/git/repositories/${repo.adoId}/pullrequests?api-version=7.0`
};

let azureService;

/**
 * @returns {AzureService}
 */
export function getAzureService() {
    if (azureService) {
        return azureService;
    } else {
        throw 'AzureServices was not initialized!';
    }
}

export function initAzureServices(encodedAuthToken) {
    if (encodedAuthToken == null) {
        throw 'Received null auth token';
    }
    if (encodedAuthToken.length == 0) {
        throw 'Received empty auth token';
    }

    if (azureService == null) {
        azureService = new AzureService(encodedAuthToken);
    }
}

class AzureService {
    constructor(encodedAuthToken) {
        this.encodedAuthToken = encodedAuthToken;
    }

    /**
     * @param {string} org
     * @param {string} project
     */
    fetchRepositories(org, project) {
        const headers = new Headers();
        headers.append('Authorization', `Basic ${this.encodedAuthToken}`);
        return fetch(APIS.listRepos(org, project), {
                method: 'GET',
                headers: headers
            })
            .then(resp => {
                if (!resp.ok) {
                    throw 'Response from ADO was not OK';
                }
                return resp.json();
            })
            .catch(err => alert(err));
    }

    /**
     * @param {Repository} repo
     * @param {string} branchName
     * @param {string} rootId
     */
    postNewReleaseBranch(repo, branchName, rootId) {
        const headers = new Headers();
        headers.append('Authorization', `Basic ${this.encodedAuthToken}`);
        headers.append('Content-Type', 'application/json');
        return fetch(APIS.createRef(repo), {
                method: 'POST',
                headers: headers,
                body: JSON.stringify([{
                    name: branchName,
                    oldObjectId: '0000000000000000000000000000000000000000',
                    newObjectId: rootId
                }])
            })
            .then(resp => {
                if (!resp.ok) {
                    throw 'Response from ADO was not OK';
                }
                return resp.json();
            })
            .catch(err => alert(err));
    }

    /**
     * @param {Repository} repo
     * @param {string} baseBranch
     * @param {string} targetBranch
     */
    getBranchDiff(repo, baseBranch, targetBranch) {
        const headers = new Headers();
        headers.append('Authorization', `Basic ${this.encodedAuthToken}`);
        return fetch(APIS.getBranchDiff(repo, baseBranch, targetBranch), {
                method: 'GET',
                headers: headers
            })
            .then(resp => {
                if (resp.ok || resp.status === 404) {
                    return resp.json();
                } else {
                    throw 'Response from ADO was not OK nor 404';
                }
            })
            .catch(err => alert(err));
    }

    /**
     * @param {Repository} repo
     * @param {string} sourceBranch
     * @param {string} targetBranch
     * @param {string} title
     * @param {string} desc
     * @param {Array} reviewers
     */
    postPullRequest(repo, sourceBranch, targetBranch, title, desc, reviewers) {
        const headers = new Headers();
        headers.append('Authorization', `Basic ${this.encodedAuthToken}`);
        headers.append('Content-Type', 'application/json');
        return fetch(APIS.createPr(repo), {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    sourceRefName: sourceBranch,
                    targetRefName: targetBranch,
                    title: title,
                    description: desc,
                    reviwers: reviewers
                })
            })
            .then(resp => {
                if (!resp.ok) {
                    throw 'Response from ADO was not OK';
                }
                return resp.json();
            })
            .catch(err => alert(err));
    }

    /**
     * @param {Repository} repo
     * @param {string} filterContains
     */
    fetchBranchInfo(repo, filterContains) {
        const headers = new Headers();
        headers.append('Authorization', `Basic ${this.encodedAuthToken}`);
        return fetch(APIS.retrieveRef(repo, filterContains), {
                method: 'GET',
                headers: headers
            })
            .then(resp => {
                if (!resp.ok) {
                    throw 'Response from ADO was not OK';
                }
                return resp.json();
            })
            .catch(err => alert(err));
    }
}