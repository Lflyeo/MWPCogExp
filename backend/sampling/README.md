# Experiment Material Sampling

Offline stratified coverage sampling for the eye-tracking MWP experiment.

## Design

1. **Hard constraint**: each participant gets 3 items from each of 5 `level5` bands (15 total).
2. **Coverage**: `unused_first` prefers never-used items; falls back to weight `1/(1+c_i)`.
3. **Reproducible**: single `random.Random(seed)` for all draws and presentation shuffles.
4. Does **not** mutate `MWPs.json` / `mwps` table.

## Run (CLI)

```bash
cd backend
pip install matplotlib
python -m sampling.run_sampling
python -m sampling.run_sampling --seed 20260908 --mode deal
```

## Admin UI

1. Open **管理后台 → 分层覆盖抽样** (`/admin/experiment-sampling`)
2. Set seed/mode → **运行抽样**
3. Review coverage + figures → **导入为实验流**
4. Participants pick `flow-p001` … on `/experiment`

Admin API:

- `POST /api/admin/experiment-sampling/run`
- `GET  /api/admin/experiment-sampling/outputs`
- `GET  /api/admin/experiment-sampling/outputs/{seed}`
- `POST /api/admin/experiment-sampling/import`

Outputs go to `sampling/output/{seed}/`.

## Import helper

```python
from sampling.import_to_experiment import import_assignments_to_db
# import_assignments_to_db(db, "sampling/output/20260907/assignments.json")
```
