<script>
    export let title;
    export let repos;
    export let buttonMessage;
    export let submitFunction;

    let selectedRepos = [];

    function submit() {
        submitFunction(selectedRepos);
    }
</script>

<form>
    <fieldset>
        <legend>{title}</legend>
        {#each repos as repo}
        <label>
            <input type="checkbox" bind:group={selectedRepos} value={repo}>
            {repo.name} - {repo.branch}/
        </label>
        <br>
        {/each}
        <button on:click|preventDefault={submit}>{buttonMessage}</button>
    </fieldset>
</form>

<style>
    label {
        display: inline;
    }
</style>