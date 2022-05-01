const startsWithRefs = /^refs\/heads\//;

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

export function trimBranchName(branchName) {
    if (branchName == null) {
        throw 'Received null branch name';
    }

    if (startsWithRefs.test(branchName)) {
        return branchName.replace(startsWithRefs, '');
    } else {
        return branchName;
    }
}

export function convertToGitBranchName(branchName) {
    if (branchName == null) {
        throw 'Received null branch name';
    }

    if (startsWithRefs.test(branchName)) {
        return branchName;
    } else {
        return 'refs/heads/' + branchName;
    }

}

export function createReleaseBranchName(date) {
    if (date == null) {
        throw 'Received null date';
    }
    return `release/${date.getFullYear()}-${MONTHS[date.getUTCMonth()]}-${date.getUTCDate()}`
}

/**
 * @param {object} jsonObj
 * @param {string} org
 * @param {string} project
 * @returns {Repository}
 */
export function mapJsonToRepository(jsonObj, org, project, id) {
    return new Repository(
        id,
        jsonObj.id,
        trimBranchName(jsonObj.defaultBranch),
        jsonObj.name,
        org,
        project
    );
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