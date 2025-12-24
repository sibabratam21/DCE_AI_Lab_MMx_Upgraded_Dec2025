"""Posterior diagnostics for Bayesian MMM."""
import arviz as az
import numpy as np
from typing import Dict, Any
from .storage import get_run_dir, load_json, save_json


def compute_diagnostics(run_id: str) -> Dict[str, Any]:
    """
    Compute posterior diagnostics from trained model.

    Diagnostics computed:
    - R-hat (Gelman-Rubin): convergence diagnostic (should be < 1.01)
    - ESS bulk: effective sample size for bulk of distribution
    - ESS tail: effective sample size for tails
    - Divergences: number of divergent transitions (should be 0)
    - Energy diagnostics: E-BFMI (should be > 0.2)
    - Max tree depth: percentage of samples hitting max tree depth

    Args:
        run_id: Run identifier

    Returns:
        Diagnostics dictionary

    Outputs:
        - diagnostics.json
    """
    run_dir = get_run_dir(run_id)

    # Load posterior
    posterior_path = run_dir / "posterior.nc"
    if not posterior_path.exists():
        raise FileNotFoundError(f"No posterior found for run {run_id}")

    trace = az.from_netcdf(str(posterior_path))

    # Load model metadata
    model_metadata = load_json(run_dir / "model_metadata.json")
    n_channels = model_metadata["n_channels"]
    n_controls = model_metadata["n_controls"]

    # Initialize diagnostics
    diagnostics = {
        "run_id": run_id,
        "overall_status": "PASS",  # Will update if any checks fail
        "convergence": {},
        "sampling_quality": {},
        "warnings": []
    }

    # 1. R-hat convergence diagnostic
    var_names = ["intercept", "sigma", "nu"]
    if n_channels > 0:
        var_names.extend(["beta", "sigma_beta"])
    if n_controls > 0:
        var_names.append("gamma")

    rhat_values = {}
    max_rhat = 0.0

    for var_name in var_names:
        if var_name in trace.posterior:
            rhat = az.rhat(trace, var_names=[var_name])
            rhat_array = rhat[var_name].values

            # Flatten if multi-dimensional
            rhat_flat = rhat_array.flatten()

            rhat_values[var_name] = {
                "max": float(np.max(rhat_flat)),
                "mean": float(np.mean(rhat_flat))
            }

            max_rhat = max(max_rhat, float(np.max(rhat_flat)))

    diagnostics["convergence"]["rhat"] = rhat_values
    diagnostics["convergence"]["max_rhat"] = max_rhat

    if max_rhat > 1.01:
        diagnostics["overall_status"] = "WARNING"
        diagnostics["warnings"].append(
            f"Poor convergence: max R-hat = {max_rhat:.4f} (should be < 1.01)"
        )

    # 2. Effective sample size
    ess_bulk_values = {}
    ess_tail_values = {}
    min_ess_bulk = float('inf')
    min_ess_tail = float('inf')

    for var_name in var_names:
        if var_name in trace.posterior:
            ess_bulk = az.ess(trace, var_names=[var_name], method="bulk")
            ess_tail = az.ess(trace, var_names=[var_name], method="tail")

            ess_bulk_array = ess_bulk[var_name].values.flatten()
            ess_tail_array = ess_tail[var_name].values.flatten()

            ess_bulk_values[var_name] = {
                "min": float(np.min(ess_bulk_array)),
                "mean": float(np.mean(ess_bulk_array))
            }

            ess_tail_values[var_name] = {
                "min": float(np.min(ess_tail_array)),
                "mean": float(np.mean(ess_tail_array))
            }

            min_ess_bulk = min(min_ess_bulk, float(np.min(ess_bulk_array)))
            min_ess_tail = min(min_ess_tail, float(np.min(ess_tail_array)))

    diagnostics["sampling_quality"]["ess_bulk"] = ess_bulk_values
    diagnostics["sampling_quality"]["ess_tail"] = ess_tail_values
    diagnostics["sampling_quality"]["min_ess_bulk"] = min_ess_bulk
    diagnostics["sampling_quality"]["min_ess_tail"] = min_ess_tail

    # Recommended minimum ESS is 400
    if min_ess_bulk < 400:
        diagnostics["warnings"].append(
            f"Low effective sample size (bulk): {min_ess_bulk:.0f} (recommended > 400)"
        )

    if min_ess_tail < 400:
        diagnostics["warnings"].append(
            f"Low effective sample size (tail): {min_ess_tail:.0f} (recommended > 400)"
        )

    # 3. Divergences
    if hasattr(trace, "sample_stats") and "diverging" in trace.sample_stats:
        divergences = trace.sample_stats["diverging"].values
        n_divergences = int(np.sum(divergences))

        diagnostics["sampling_quality"]["n_divergences"] = n_divergences
        diagnostics["sampling_quality"]["divergence_rate"] = float(
            n_divergences / divergences.size
        )

        if n_divergences > 0:
            diagnostics["overall_status"] = "WARNING"
            diagnostics["warnings"].append(
                f"Found {n_divergences} divergent transitions (should be 0). "
                "Consider increasing target_accept."
            )
    else:
        diagnostics["sampling_quality"]["n_divergences"] = None

    # 4. Energy diagnostic (E-BFMI)
    if hasattr(trace, "sample_stats") and "energy" in trace.sample_stats:
        energy = trace.sample_stats["energy"].values

        # Compute E-BFMI for each chain
        ebfmi_per_chain = []
        for chain_idx in range(energy.shape[0]):
            chain_energy = energy[chain_idx, :]
            energy_diff = np.diff(chain_energy)
            ebfmi = np.var(energy_diff) / np.var(chain_energy)
            ebfmi_per_chain.append(ebfmi)

        min_ebfmi = float(np.min(ebfmi_per_chain))
        mean_ebfmi = float(np.mean(ebfmi_per_chain))

        diagnostics["sampling_quality"]["ebfmi"] = {
            "min": min_ebfmi,
            "mean": mean_ebfmi,
            "per_chain": [float(x) for x in ebfmi_per_chain]
        }

        if min_ebfmi < 0.2:
            diagnostics["warnings"].append(
                f"Low E-BFMI: {min_ebfmi:.3f} (should be > 0.2). "
                "Model may be difficult to sample."
            )
    else:
        diagnostics["sampling_quality"]["ebfmi"] = None

    # 5. Max tree depth warnings
    if hasattr(trace, "sample_stats") and "tree_size" in trace.sample_stats:
        tree_size = trace.sample_stats["tree_size"].values
        max_tree_depth = int(np.log2(model_metadata.get("max_treedepth", 10)))
        max_tree_size = 2 ** max_tree_depth

        n_max_depth = int(np.sum(tree_size >= max_tree_size))
        max_depth_rate = float(n_max_depth / tree_size.size)

        diagnostics["sampling_quality"]["max_tree_depth_rate"] = max_depth_rate

        if max_depth_rate > 0.01:  # More than 1% hitting max depth
            diagnostics["warnings"].append(
                f"{max_depth_rate*100:.1f}% of samples hit max tree depth. "
                "Consider reparameterizing the model."
            )
    else:
        diagnostics["sampling_quality"]["max_tree_depth_rate"] = None

    # 6. Summary statistics
    chains = model_metadata["chains"]
    draws = model_metadata["draws"]

    diagnostics["sampling_summary"] = {
        "chains": chains,
        "draws_per_chain": draws,
        "total_draws": chains * draws,
        "tune": model_metadata["tune"]
    }

    # Save diagnostics
    save_json(diagnostics, run_dir / "diagnostics.json")

    return diagnostics


def get_diagnostic_summary(diagnostics: Dict[str, Any]) -> str:
    """
    Generate human-readable summary of diagnostics.

    Args:
        diagnostics: Diagnostics dictionary from compute_diagnostics

    Returns:
        Formatted summary string
    """
    lines = []
    lines.append("=== Posterior Diagnostics Summary ===")
    lines.append(f"Overall Status: {diagnostics['overall_status']}")
    lines.append("")

    # Convergence
    lines.append("Convergence:")
    max_rhat = diagnostics["convergence"]["max_rhat"]
    lines.append(f"  Max R-hat: {max_rhat:.4f} {'✓' if max_rhat < 1.01 else '⚠️'}")

    # Sampling quality
    lines.append("")
    lines.append("Sampling Quality:")

    min_ess_bulk = diagnostics["sampling_quality"]["min_ess_bulk"]
    min_ess_tail = diagnostics["sampling_quality"]["min_ess_tail"]

    lines.append(f"  Min ESS (bulk): {min_ess_bulk:.0f} {'✓' if min_ess_bulk >= 400 else '⚠️'}")
    lines.append(f"  Min ESS (tail): {min_ess_tail:.0f} {'✓' if min_ess_tail >= 400 else '⚠️'}")

    if diagnostics["sampling_quality"]["n_divergences"] is not None:
        n_div = diagnostics["sampling_quality"]["n_divergences"]
        lines.append(f"  Divergences: {n_div} {'✓' if n_div == 0 else '⚠️'}")

    if diagnostics["sampling_quality"]["ebfmi"] is not None:
        min_ebfmi = diagnostics["sampling_quality"]["ebfmi"]["min"]
        lines.append(f"  Min E-BFMI: {min_ebfmi:.3f} {'✓' if min_ebfmi >= 0.2 else '⚠️'}")

    # Warnings
    if diagnostics["warnings"]:
        lines.append("")
        lines.append("Warnings:")
        for warning in diagnostics["warnings"]:
            lines.append(f"  - {warning}")

    return "\n".join(lines)
