const userName = window.prompt('Enter username');
const encodedAuthToken = btoa(`${userName}:${window.prompt('Enter PAT KEY')}`);

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

const CONSTANTS = {
    ORGANIZATION: 'REPLACE_ME',
    TEAM: 'REPLACE_ME',
    TARGET_BRANCHES: [
        'REPLACE_ME'
    ]
}

const APIS = {
    listRepos: () => `https://dev.azure.com/${CONSTANTS.ORGANIZATION}/${CONSTANTS.TEAM}/_apis/git/repositories?api-version=7.0`,
    createRef: repoId => `https://dev.azure.com/${CONSTANTS.ORGANIZATION}/${CONSTANTS.TEAM}/_apis/git/repositories/${repoId}/refs?api-version=7.0`,
    retrieveRef: (repoId, filter) => `https://dev.azure.com/${CONSTANTS.ORGANIZATION}/${CONSTANTS.TEAM}/_apis/git/repositories/${repoId}/refs?api-version=7.0&filterContains=${encodeURIComponent(filter)}`,
    getBranchDiff: (repoId, bBranch, tBranch) => `https://dev.azure.com/${CONSTANTS.ORGANIZATION}/${CONSTANTS.TEAM}/_apis/git/repositories/${repoId}/diffs/commits?api-version=7.0&baseVersion=${bBranch}&targetVersion=${tBranch}`,
    createPr: repoId => `https://dev.azure.com/${CONSTANTS.ORGANIZATION}/${CONSTANTS.TEAM}/_apis/git/repositories/${repoId}/pullrequests?api-version=7.0`
};

function createReleaseBranchName(date) {
    return `release/${date.getFullYear()}-${MONTHS[date.getUTCMonth()]}-${date.getUTCDate()}`
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

// {
//     id
//     defaultBranch
//     name
// }
const repoMap = {};

////////////////////////////////////////////////////////////////
// SERVICE CALLS
////////////////////////////////////////////////////////////////

function fetchRepositories() {
    const headers = new Headers();
    headers.append('Authorization', `Basic ${encodedAuthToken}`);
    return fetch(APIS.listRepos(), {
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

function fetchBranchInfo(repoId, filterContains) {
    const headers = new Headers();
    headers.append('Authorization', `Basic ${encodedAuthToken}`);
    return fetch(APIS.retrieveRef(repoId, filterContains), {
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

function postNewReleaseBranch(repoId, branchName, rootId) {
    const headers = new Headers();
    headers.append('Authorization', `Basic ${encodedAuthToken}`);
    headers.append('Content-Type', 'application/json');
    return fetch(APIS.createRef(repoId), {
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

function getBranchDiff(repoId, baseBranch, targetBranch) {
    const headers = new Headers();
    headers.append('Authorization', `Basic ${encodedAuthToken}`);
    return fetch(APIS.getBranchDiff(repoId, baseBranch, targetBranch), {
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

function postPullRequest(repoId, sourceBranch, targetBranch, title, desc, reviewers) {
    const headers = new Headers();
    headers.append('Authorization', `Basic ${encodedAuthToken}`);
    headers.append('Content-Type', 'application/json');
    return fetch(APIS.createPr(repoId), {
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

async function tryToCreatePr(repoId, sourceBranch, targetBranch) {
    const diffResult = await getBranchDiff(repoId, targetBranch, sourceBranch);

    if (!diffResult.changes || diffResult.changes.length == 0) {
        return { message: 'No changes or branch to create PR for', success: false };
    }

    const title = `Merge ${sourceBranch}`;
    const desc = `Merging ${sourceBranch} into ${targetBranch}`;
    const srcB = convertToGitBranchName(sourceBranch);
    const tarB = convertToGitBranchName(targetBranch);
    const result = await postPullRequest(repoId, srcB, tarB, title, desc, []);
    const message = result.mergeStatus === 'queued' ? 'PR created' : 'Failed to create PR';
    return { message: message, success: result.mergeStatus === 'queued' };
}

async function createReleaseBranch(releaseDate, repoId) {
    const defaultBranchInfo = await fetchBranchInfo(repoId, repoMap[repoId].defaultBranch);
    const gitBranchname = convertToGitBranchName(createReleaseBranchName(releaseDate));
    const postResult = await postNewReleaseBranch(repoId, gitBranchname, defaultBranchInfo.value[0].objectId);
    return postResult.value.length > 0 && postResult.value[0].success;
}

async function loadRepositories() {
    const jason = await fetchRepositories();
    for (repo of jason.value) {
        repoMap[repo.id] = {
            id: repo.id,
            defaultBranch: trimBranchName(repo.defaultBranch),
            name: repo.name
        }
    }
    return 'Success';
}

async function findReposWithRelBranches(date) {
    await loadRepositories();
    const branchInfos = [];
    const relBranchName = createReleaseBranchName(date);
    Object.entries(repoMap).forEach(el => {
        const repoId = el[0];
        branchInfos.push(fetchBranchInfo(repoId, relBranchName)
            .then(jason => {
                return {
                    repoId: repoId,
                    jason: jason
                };
            }));
    });
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
        repositories.forEach(repo => {
            if (repo.checked) {
                createReleaseBranch(releaseDate, repo.value).then(success => {
                    const resultMessage = `${repo.name} ${success ? 'created branch' : 'failed to create branch'}\n`;
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
            CONSTANTS.TARGET_BRANCHES.forEach(targetBranch => {
                tryToCreatePr(repoId, releaseBranchName, targetBranch)
                    .then(resp => {
                        if (resp.success) {
                            const resultMessage = repoMap[repoId].name + ` created PR into ${targetBranch}\n`;
                            textAreaEl.value = textAreaEl.value ? textAreaEl.value + resultMessage : resultMessage;
                        }
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