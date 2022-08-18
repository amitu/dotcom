-- ds.page: Github Actions

- Every file in `.github/workflows/` file creates a `workflow` ([syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)). 
- Each workflow is [triggered on a event](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow). 
  Event can be say git/Github events, like push, or issue created etc. 
- Events can also be custom external, called [workflow_dispatch](https://docs.github.com/en/actions/managing-workflow-runs/manually-running-a-workflow).
  - Such workflows can run using [actions tab manually](https://docs.github.com/en/actions/managing-workflow-runs/manually-running-a-workflow#running-a-workflow), 
    via [github cli](https://cli.github.com/manual/gh_workflow_run), 
    or via [API call](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
  - workflow_dispatch workflows [can also accept input](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#providing-inputs),
    you specify what all inputs are required, and github auto creates a UI in the action tab, or does input validation 
    when using cli or api. You can use the inputs using `${{ inputs.logLevel }}` syntax.
- Events [can be filtered](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#filter-pattern-cheat-sheet),
  so eg only if a file/pattern is modified in a commit.
- Workflow is composed of one or more `job`s. Each `job` is a run on a "runner machine".

