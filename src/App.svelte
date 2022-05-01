<script>
	import RepoSelect from "./components/RepoSelect.svelte";
	import ResultMessage from "./components/ResultMessage.svelte";
	import { CONFIG } from "./config.js";
	import {
		loadRepositories,
		findReposWithRelBranches,
		createReleaseBranch,
		tryToCreatePr,
	} from "./services/functions";
	import { initAzureServices } from "./services/azureServices";
	import { createReleaseBranchName } from "./util/util";
	import { onMount } from "svelte";

	const encodedAuthToken = btoa(
		`${window.prompt("Username")}:${window.prompt("Access Token")}`
	);

	onMount(() => {
		initAzureServices(encodedAuthToken);
	});

	let title;
	let buttonMessage;
	let submitFunction;
	let chosenDate = false;
	let date;
	let loadRepoPromise;
	let submitResults = [];

	function clickCreateBranches() {
		chosenDate = true;
		const dateObj = new Date(date);
		title = `Create branch "${createReleaseBranchName(dateObj)}"`;
		buttonMessage = "Create Branches";
		loadRepoPromise = loadRepositories(CONFIG).then(repos => repos.map(repo => {
			repo.branch = repo.defaultBranch
			return repo;
		}));
		submitFunction = (repos) => {
			Promise.all(
				repos.map((repo) => createReleaseBranch(dateObj, repo))
			).then((results) => (submitResults = results));
		};
	}

	function clickMergeBranches() {
		chosenDate = true;
		const dateObj = new Date(date);
		const releaseBranchName = createReleaseBranchName(dateObj);
		loadRepoPromise = findReposWithRelBranches(dateObj, CONFIG).then(repos => repos.map(repo => {
			repo.branch = releaseBranchName;
			return repo;
		}));
		title = `Merge branch "${createReleaseBranchName(dateObj)}"`;
		buttonMessage = "Merge Branches";
		submitFunction = (repos) => {
			Promise.all(
				repos
					.map((repo) =>
						CONFIG.TARGET_BRANCHES.map((targetBranch) =>
							tryToCreatePr(repo, releaseBranchName, targetBranch)
						)
					)
					.flat()
			).then((results) => (submitResults = results));
		};
	}
</script>

<main>
	<div>
		<label for="releaseDatePicker">Release Date</label>
		<input
			type="date"
			id="releaseDatePicker"
			disabled={chosenDate}
			bind:value={date}
		/>
		<button on:click={clickCreateBranches}>Create Branches</button>
		<button on:click={clickMergeBranches}>Merge Branches</button>
	</div>
	<div class="workSpace">
		{#if chosenDate}
			{#await loadRepoPromise then repos}
				<div class="repoSelectDiv">
					<RepoSelect
						{repos}
						{buttonMessage}
						{submitFunction}
						{title}
					/>
				</div>
			{/await}
		{/if}
		<div id="resultsArea">
			{#each submitResults as result}
				<ResultMessage {...result} />
			{/each}
		</div>
	</div>
</main>

<style>
	.workSpace {
		display: flex;
	}

	.workSpace > * {
		flex: 1;
		margin: 10px;
	}
</style>
