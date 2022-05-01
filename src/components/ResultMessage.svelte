<script>
    export let success;
    export let message;
</script>

{#if success}
    <p class="good">{message}</p>
{:else}
    <p class="bad">{message}</p>
{/if}

<style>
    .good {
        color: #20b32f;
    }

    .bad {
        color: #b32020;
    }
</style>
