const userName = window.prompt('Enter username');
const encodedAuthToken = btoa(`${userName}:${window.prompt('Enter PAT KEY')}`);

// CONFIG.ORG_TEAMS Tells which orgs and projects branch_manager should scan to look for
// repositories.
// TARGET_BRANCHES List of branch names that branch_manager should create a PR into.
const CONFIG = {
    ORG_PROJECTS: [{
        ORGANIZATION: 'REPLACE_ME',
        PROJECT: 'REPLACE_ME'
    }],
    TARGET_BRANCHES: [
        'REPLACE_ME'
    ]
};

////////////////////////////////////////////////////////////////
// UTIL
////////////////////////////////////////////////////////////////

const MONTHS = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC'
];

const APIS = {
    listRepos: (org, project) => `https://dev.azure.com/${org}/${project}/_apis/git/repositories?api-version=7.0`,
    createRef: repo => `https://dev.azure.com/${repo.org}/${repo.project}/_apis/git/repositories/${repo.adoId}/refs?api-version=7.0`,
    retrieveRef: (repo, filter) => `https://dev.azure.com/${repo.org}/${repo.project}/_apis/git/repositories/${repo.adoId}/refs?api-version=7.0&filterContains=${encodeURIComponent(filter)}`,
    getBranchDiff: (repo, bBranch, tBranch) => `https://dev.azure.com/${repo.org}/${repo.project}/_apis/git/repositories/${repo.adoId}/diffs/commits?api-version=7.0&baseVersion=${bBranch}&targetVersion=${tBranch}`,
    createPr: repo => `https://dev.azure.com/${repo.org}/${repo.project}/_apis/git/repositories/${repo.adoId}/pullrequests?api-version=7.0`
};

function createReleaseBranchName(date) {
    return `release/${date.getFullYear()}-${MONTHS[date.getUTCMonth()]}-${date.getUTCDate()}`
}

/**
 * @param {object} jsonObj
 * @param {string} org
 * @param {string} project
 * @returns {Repository}
 */
function mapJsonToRepository(jsonObj, org, project, id) {
    return new Repository(
        id,
        jsonObj.id,
        trimBranchName(jsonObj.defaultBranch),
        jsonObj.name,
        org,
        project
    );
}

const startsWithRefs = /^refs\/heads\//;

function trimBranchName(branchName) {
    if (startsWithRefs.test(branchName)) {
        return branchName.replace(startsWithRefs, '');
    } else {
        return branchName;
    }
}

function convertToGitBranchName(branchName) {
    if (startsWithRefs.test(branchName)) {
        return branchName;
    } else {
        return 'refs/heads/' + branchName;
    }

}

class Repository {
    /**
     * @param {string} id ID to be used within this app
     * @param {string} adoId ID issued for the repo by ADO
     * @param {string} defBranch
     * @param {string} name
     * @param {string} org
     * @param {string} project
     */
    constructor(id, adoId, defBranch, name, org, project) {
        this.id = id;
        this.adoId = adoId;
        this.defaultBranch = defBranch;
        this.name = name;
        this.org = org;
        this.project = project;
    }
}

const repoMap = {};

////////////////////////////////////////////////////////////////
// SERVICE CALLS
////////////////////////////////////////////////////////////////

/**
 * @param {string} org
 * @param {string} project
 */
function fetchRepositories(org, project) {
    const headers = new Headers();
    headers.append('Authorization', `Basic ${encodedAuthToken}`);
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
 * @param {string} filterContains
 */
function fetchBranchInfo(repo, filterContains) {
    const headers = new Headers();
    headers.append('Authorization', `Basic ${encodedAuthToken}`);
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

/**
 * @param {Repository} repo
 * @param {string} branchName
 * @param {string} rootId
 */
function postNewReleaseBranch(repo, branchName, rootId) {
    const headers = new Headers();
    headers.append('Authorization', `Basic ${encodedAuthToken}`);
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
function getBranchDiff(repo, baseBranch, targetBranch) {
    const headers = new Headers();
    headers.append('Authorization', `Basic ${encodedAuthToken}`);
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
function postPullRequest(repo, sourceBranch, targetBranch, title, desc, reviewers) {
    const headers = new Headers();
    headers.append('Authorization', `Basic ${encodedAuthToken}`);
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

////////////////////////////////////////////////////////////////
// OPERATIONS
////////////////////////////////////////////////////////////////

/**
 * @param {Repository} repo
 * @param {string} sourceBranch
 * @param {string} targetBranch
 */
async function tryToCreatePr(repo, sourceBranch, targetBranch) {
    const diffResult = await getBranchDiff(repo, targetBranch, sourceBranch);

    if (!diffResult.changes || diffResult.changes.length == 0) {
        return { message: `${repo.name} : no changes between ${sourceBranch} and ${targetBranch}.`, success: false };
    }

    const title = `Merge ${sourceBranch}`;
    const desc = `Merging ${sourceBranch} into ${targetBranch}`;
    const srcB = convertToGitBranchName(sourceBranch);
    const tarB = convertToGitBranchName(targetBranch);
    const result = await postPullRequest(repo, srcB, tarB, title, desc, []);

    const successMsg = `${repo.name} : created a PR that merges ${sourceBranch} into ${targetBranch}.`;
    const failMsg = `${repo.name} : failed to create PR.`;

    const success = result.mergeStatus === 'queued';
    const message = success ? successMsg : failMsg;

    return { message: message, success: success };
}

/**
 * @param {Date} releaseDate
 * @param {Repository} repo
 */
async function createReleaseBranch(releaseDate, repo) {
    const branchName = trimBranchName(repo.defaultBranch, repo.defaultBranch);
    const defaultBranchInfo = await fetchBranchInfo(repo, '/' + branchName);
    const gitBranchname = convertToGitBranchName(createReleaseBranchName(releaseDate));
    const branch = defaultBranchInfo.value.filter(el => trimBranchName(el.name) === branchName);
    if (branch.length === 0) {
        throw `Could not find branch with name ${branchName} from the repository ${repo.name}`;
    }
    const postResult = await postNewReleaseBranch(repo, gitBranchname, branch[0].objectId);
    return postResult.value.length > 0 && postResult.value[0].success;
}

async function loadRepositories() {
    let results = [];
    for (orgTeam of CONFIG.ORG_PROJECTS) {
        const jason = await fetchRepositories(orgTeam.ORGANIZATION, orgTeam.PROJECT);
        results = results.concat(jason.value.map(el => {
            return {
                repo: el,
                org: orgTeam.ORGANIZATION,
                proj: orgTeam.PROJECT
        }
        }));
    }

    results.sort((a, b) => a.repo.name.localeCompare(b.repo.name));
    results.forEach((el, i) => {
        repoMap[i] = mapJsonToRepository(el.repo, el.org, el.proj, i);
    });
    return 'Success';
}

async function findReposWithRelBranches(date) {
    await loadRepositories();
    const branchInfos = [];
    const relBranchName = createReleaseBranchName(date);

    const reposToCheck = [];
    for (repoId in repoMap) {
        reposToCheck.push(repoMap[repoId]);
    }
    reposToCheck.forEach(repo => branchInfos.push(fetchBranchInfo(repo, relBranchName)
        .then(jason => {
            return {
                repoId: repo.id,
                jason: jason
            };
        })));

    return Promise.all(branchInfos).then(resp => {
        return resp.filter(bInfo => bInfo.jason.count > 0)
            .map(bInfo => bInfo.repoId);
    });
}

////////////////////////////////////////////////////////////////
// RENDER
////////////////////////////////////////////////////////////////

async function renderBranchCreator() {
    const fieldSetEl = document.createElement('fieldset');
    fieldSetEl.id = 'repoFieldSet';
    const legendEl = document.createElement('legend');
    legendEl.innerText = 'Repositories to create branches from';
    fieldSetEl.appendChild(legendEl);

    const buttonEl = document.createElement('button');
    buttonEl.innerText = 'Create Branches';

    const formEl = document.createElement('form');
    formEl.appendChild(fieldSetEl);
    formEl.appendChild(buttonEl);

    const controlAreaEl = document.querySelector('#controlArea');
    controlAreaEl.appendChild(formEl);

    const textAreaEl = document.createElement('textarea');
    textAreaEl.id = 'resultArea';
    textAreaEl.readOnly = true;
    controlAreaEl.appendChild(textAreaEl);

    formEl.addEventListener('submit', event => {
        event.preventDefault();
        const repositories = document.querySelectorAll('#repoFieldSet>input');
        const releaseDate = new Date(document.querySelector('#releaseDate').valueAsNumber);
        repositories.forEach(repoEl => {
            if (repoEl.checked) {
                const repo = repoMap[repoEl.id];
                createReleaseBranch(releaseDate, repo).then(success => {
                    const resultMessage = `${repoEl.name} ${success ? 'created branch' : 'failed to create branch'}\n`;
                    textAreaEl.value = textAreaEl.value ? textAreaEl.value + resultMessage : resultMessage;
                });
            }
        });
    });

    await loadRepositories();
    for (repoId in repoMap) {
        const repo = repoMap[repoId];

        const checkBox = document.createElement('input');
        checkBox.type = 'checkbox';
        checkBox.id = repo.id;
        checkBox.value = repo.id;
        checkBox.name = repo.name;

        const label = document.createElement('label');
        label.innerText = `${repo.name} - ${repo.defaultBranch}/`;
        label.for = repo.id;
        fieldSetEl.appendChild(checkBox);
        fieldSetEl.appendChild(label);
        fieldSetEl.appendChild(document.createElement('br'));
    }
}

async function renderCreatePr() {
    const ulEl = document.createElement('ul');

    const textAreaEl = document.createElement('textarea');
    textAreaEl.id = 'prCreationBox';

    const button = document.createElement('button');
    button.innerText = 'Create PRs';

    const controlAreaEl = document.querySelector('#controlArea');

    const date = new Date(document.querySelector('#releaseDate').valueAsNumber);
    const releaseBranchName = createReleaseBranchName(date);

    const h4 = document.createElement('h4');
    h4.innerText = `Repositories with ${releaseBranchName} branch:`;

    const availableRepoDiv = document.createElement('div');
    availableRepoDiv.appendChild(h4);
    availableRepoDiv.appendChild(ulEl);
    availableRepoDiv.appendChild(button);

    controlAreaEl.appendChild(availableRepoDiv);
    controlAreaEl.appendChild(textAreaEl);

    const reposToMerge = await findReposWithRelBranches(date);
    for (repoId of reposToMerge) {
        const listItemEl = document.createElement('li');
        listItemEl.innerText = repoMap[repoId].name;
        ulEl.appendChild(listItemEl);
    }

    button.onclick = () => {
        reposToMerge.forEach(repoId => {
            CONFIG.TARGET_BRANCHES.forEach(targetBranch => {
                tryToCreatePr(repoMap[repoId], releaseBranchName, targetBranch)
                    .then(resp => {
                        textAreaEl.value = (textAreaEl.value ? textAreaEl.value + resp.message : resp.message) + '\n';
                    });
            });
        });
    };
}

function onCreateBranchOptionClick() {
    const releaseDate = document.querySelector('#releaseDate');
    if (releaseDate.value && !releaseDate.disabled) {
        releaseDate.disabled = true;
        renderBranchCreator();
    }
}

function onCreatePrsOptionClick() {
    const releaseDate = document.querySelector('#releaseDate');
    if (releaseDate.value && !releaseDate.disabled) {
        releaseDate.disabled = true;
        renderCreatePr();
    }
}