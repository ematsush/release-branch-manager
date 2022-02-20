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
    ORGANIZATION: 'REPLACEME',
    TEAM: 'REPLACEME'
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
                throw 'REsponse from ADO was not OK';
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
                'name': `refs/heads/${branchName}`,
                'oldObjectId': '0000000000000000000000000000000000000000',
                'newObjectId': rootId
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
            if (!resp.ok) {
                throw 'Response from ADO was not OK';
            }
            return resp.json();
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
    if (startsWithRefs.test(sourceBranch)) {
        throw 'sourceBranch should not start with refs/heads';
    }
    if (startsWithRefs.test(targetBranch)) {
        throw 'targetBranch should not start with refs/heads';
    }

    const diffResult = await getBranchDiff(repoId, targetBranch, sourceBranch);

    if (diffResult.changes.length == 0) {
        return Promise.resolve();
    }

    const title = `Merge ${sourceBranch}`;
    const desc = `Merging ${sourceBranch} into ${targetBranch}`;
    return await postPullRequest(repoId, 'refs/heads/' + sourceBranch, 'refs/heads/' + targetBranch, title, desc, []);
}

async function createReleaseBranch(releaseDate, repoId) {
    const defaultBranchInfo = await fetchBranchInfo(repoId, 'master');
    const postResult = await postNewReleaseBranch(repoId, createReleaseBranchName(releaseDate), defaultBranchInfo.value[0].objectId);
    return postResult.value.length > 0 && postResult.value[0].success;
}

////////////////////////////////////////////////////////////////
// RENDER
////////////////////////////////////////////////////////////////

function renderBranchCreator() {
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

    fetchRepositories()
        .then(jason => {
            for (repo of jason.value) {
                const checkBox = document.createElement('input');
                checkBox.type = 'checkbox';
                checkBox.id = repo.id;
                checkBox.value = repo.id;
                checkBox.name = repo.name;

                const label = document.createElement('label');
                label.innerText = repo.name;
                label.for = repo.id;
                fieldSetEl.appendChild(checkBox);
                fieldSetEl.appendChild(label);
                fieldSetEl.appendChild(document.createElement('br'));
            }
        });
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

    const repos = await fetchRepositories();
    const responseList = [];
    repos.value.forEach(el => {
        responseList.push(fetchBranchInfo(el.id, releaseBranchName)
            .then(jason => {
                return {
                    repoId: el.id,
                    repoName: el.name,
                    result: jason
                };
            }));
    });

    const reposToMerge = [];
    Promise.all(responseList).then(resps => {
        for (resp of resps) {
            if (resp.result.value.length > 0) {
                reposToMerge.push(resp.repoId);
                const listItemEl = document.createElement('li');
                listItemEl.innerText = resp.repoName;
                ulEl.appendChild(listItemEl);
            }
        }
    });

    button.onclick = () => {
        reposToMerge.forEach(repoId => {
            // modify here to add additional branches to merge into.
            tryToCreatePr(repoId, releaseBranchName, 'master')
                .then(resp => {
                    if (resp) {
                        const resultMessage = resp.repository.name + ' created PR into master\n';
                        textAreaEl.value = textAreaEl.value ? textAreaEl.value + resultMessage : resultMessage;
                    }
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