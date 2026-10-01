// Generated from Factory production intake. SHA256: e0a02d6fea6ce2bcfd4782b139c805cb1b737e39a3f92ea1ee56035edd7c1294
/** Runs in the owning repository with read-only GitHub access. No cloud or npm credentials. */
export async function collectProduction(repository, token, workflow, jobName, runId) {
    const get = async (path) => {
        const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, { redirect: 'error', signal: AbortSignal.timeout(20000),
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
        if (!response.ok)
            throw new Error(`GitHub production read failed (${response.status}).`);
        return response.json();
    };
    const ownedRun = (r) => r && r.head_branch === 'master' && ['push', 'workflow_dispatch'].includes(r.event)
        && r.path === `.github/workflows/${workflow}` && r.head_repository?.full_name === repository;
    const { workflow_runs: history } = await get(`actions/workflows/${workflow}/runs?branch=master&per_page=30`);
    const run = runId ? await get(`actions/runs/${runId}`) : history.find(ownedRun);
    if (!ownedRun(run))
        return null;
    const jobs = async (r) => (await get(`actions/runs/${r.id}/attempts/${r.run_attempt}/jobs?per_page=100`));
    const deploymentJobs = (r, result) => result.jobs.filter((j) => j.name === jobName && j.head_sha === r.head_sha);
    const current = await jobs(run);
    if (current.total_count > 100)
        throw new Error('Production workflow has more jobs than the collector supports.');
    const matching = deploymentJobs(run, current);
    if (matching.length > 1)
        throw new Error('Production job name must be unique.');
    const job = matching[0];
    const state = run.status !== 'completed' ? 'running' : run.conclusion !== 'success' ? 'failed'
        : job?.status === 'completed' && job.conclusion === 'success' ? 'deployed' : 'skipped';
    const pullRequests = [];
    let linkageComplete = false;
    // Only an earlier successful deployment establishes the range of newly shipped commits.
    // The first tracked release retains its build receipt but requires a person to review its ticket scope.
    if (state === 'deployed') {
        let previous;
        // A rerun finishes at a different time than its original creation. Compare the latest
        // completed receipts so a later rerun cannot become an earlier deployment boundary.
        const earlier = history.filter((r) => ownedRun(r) && r.id !== run.id && r.updated_at < run.updated_at && r.status === 'completed' && r.conclusion === 'success')
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 10);
        for (const candidate of earlier) {
            const prior = await jobs(candidate);
            const matches = deploymentJobs(candidate, prior);
            if (prior.total_count <= 100 && matches.length === 1 && matches[0].status === 'completed' && matches[0].conclusion === 'success') {
                previous = candidate;
                break;
            }
        }
        if (previous) {
            const diff = await get(`compare/${previous.head_sha}...${run.head_sha}?per_page=100`);
            if (['ahead', 'identical'].includes(diff.status) && diff.total_commits <= 100) {
                linkageComplete = true;
                const found = new Map();
                for (const commit of diff.commits) {
                    const prs = await get(`commits/${commit.sha}/pulls?per_page=100`);
                    if (prs.length >= 100) {
                        linkageComplete = false;
                        break;
                    }
                    for (const pr of prs)
                        if (pr.merged_at && ['staging', 'master'].includes(pr.base?.ref) && pr.base?.repo?.full_name === repository && pr.merge_commit_sha && diff.commits.some((c) => c.sha === pr.merge_commit_sha))
                            found.set(pr.number, pr);
                }
                if (found.size > 50)
                    linkageComplete = false;
                if (linkageComplete)
                    for (const pr of found.values()) {
                        const rows = await get(`pulls/${pr.number}/files?per_page=100`);
                        if (rows.length >= 100)
                            linkageComplete = false;
                        pullRequests.push({ number: pr.number, title: pr.title.slice(0, 300), body: (pr.body ?? '').slice(0, 20000), headRef: pr.head.ref,
                            mergeSha: pr.merge_commit_sha, files: rows.length < 100 ? rows.map((f) => f.filename) : null });
                    }
            }
        }
    }
    return { repository, workflow, runId: String(run.id), attempt: run.run_attempt, candidate: run.head_sha, state,
        url: `https://github.com/${repository}/actions/runs/${run.id}`, createdAt: run.created_at, updatedAt: run.updated_at,
        observedAt: new Date().toISOString(), job: job ? { name: job.name, status: job.status, conclusion: job.conclusion } : null, linkageComplete, pullRequests };
}

// Appended to the compiled production collector by scripts/sync-production-intake.mjs.
const endpoint = 'https://factory-rover-81024286635.us-west1.run.app/github/production-intake';
try {
  let runIds = [process.env.FACTORY_RUN_ID].filter(Boolean);
  if (!runIds.length) {
    const history = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/${process.env.FACTORY_PRODUCTION_WORKFLOW}/runs?branch=master&per_page=30`, {
      redirect: 'error', signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } });
    if (!history.ok) throw new Error(`GitHub production history failed (${history.status}).`);
    runIds = (await history.json()).workflow_runs.filter(r => ['push', 'workflow_dispatch'].includes(r.event) && Date.now() - Date.parse(r.created_at) < 7 * 86400000)
      .map(r => String(r.id)).reverse();
  }
  let failed = false;
  for (const runId of runIds) try {
    const payload = await collectProduction(process.env.GITHUB_REPOSITORY, process.env.GITHUB_TOKEN, process.env.FACTORY_PRODUCTION_WORKFLOW, process.env.FACTORY_PRODUCTION_JOB, runId);
    if (!payload) continue;
    const request = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
    request.searchParams.set('audience', 'https://factory.dealmachine.com/production-intake');
    const identity = await fetch(request, { headers: { Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` }, signal: AbortSignal.timeout(20000) });
    if (!identity.ok) throw new Error(`GitHub identity request failed (${identity.status}).`);
    const { value } = await identity.json();
    if (!value) throw new Error('GitHub returned no intake identity.');
    let body = JSON.stringify(payload);
    if (Buffer.byteLength(body) > 500000) {
      payload.pullRequests = []; payload.linkageComplete = false; body = JSON.stringify(payload);
    }
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${value}`, 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Factory production intake failed (${response.status}); scheduled reconciliation will retry.`);
    console.log(`Recorded production run ${payload.runId}, attempt ${payload.attempt}: ${payload.state}.`);
  } catch (error) { failed = true; console.error(`Production run ${runId}: ${error.message}`); }
  if (failed) process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
