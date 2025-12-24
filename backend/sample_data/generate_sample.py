"""Generate synthetic MMM dataset for testing."""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


def generate_sample_mmm_dataset(
    n_weeks: int = 104,  # 2 years
    n_entities: int = 50,  # 50 stores/locations
    channels: list = None,
    random_seed: int = 42
) -> pd.DataFrame:
    """
    Generate synthetic MMM dataset.

    Args:
        n_weeks: Number of weeks
        n_entities: Number of entities (stores/locations)
        channels: List of channel names
        random_seed: Random seed for reproducibility

    Returns:
        DataFrame with columns:
        - entity_id
        - period_start
        - sales
        - act_* (activity columns)
        - ctrl_* (control columns)
        - spend_* (spend columns)
    """
    np.random.seed(random_seed)

    if channels is None:
        channels = ["tv", "digital", "radio", "print", "social"]

    # Generate time periods (weekly)
    start_date = datetime(2022, 1, 3)  # Monday
    periods = [start_date + timedelta(weeks=i) for i in range(n_weeks)]

    # Entity IDs
    entity_ids = [f"store_{i:03d}" for i in range(n_entities)]

    # Build dataset
    rows = []

    for entity_idx, entity_id in enumerate(entity_ids):
        # Entity-specific baseline
        entity_baseline = 1000 + np.random.normal(0, 200)

        # Entity-specific channel sensitivities
        entity_sensitivities = {
            channel: np.random.uniform(0.3, 1.5)
            for channel in channels
        }

        for week_idx, period_start in enumerate(periods):
            # Trend component
            trend = week_idx * 2.0

            # Seasonality (annual cycle)
            seasonality = 200 * np.sin(2 * np.pi * week_idx / 52)

            # Control variables
            price_index = 100 + np.random.normal(0, 5)
            competitor_activity = np.random.uniform(0, 1)

            # Marketing activities and spend
            activities = {}
            spends = {}

            for channel in channels:
                # Spend follows seasonal pattern + random variation
                base_spend = {
                    "tv": 5000,
                    "digital": 3000,
                    "radio": 2000,
                    "print": 1500,
                    "social": 1000
                }.get(channel, 2000)

                # Add seasonality to spend (Q4 boost)
                quarter_boost = 1.3 if week_idx % 52 >= 39 else 1.0

                spend = base_spend * quarter_boost * np.random.uniform(0.7, 1.3)
                spends[channel] = spend

                # Activity is correlated with spend but not perfectly
                # Assume activity = impressions or clicks
                activity = spend * np.random.uniform(50, 150)  # impressions per dollar
                activities[channel] = activity

            # Generate sales with marketing effects
            sales = entity_baseline + trend + seasonality

            # Control effects
            sales += -10 * (price_index - 100)  # Price elasticity
            sales += -100 * competitor_activity  # Competitor effect

            # Marketing effects with adstock
            for channel in channels:
                # Simple immediate effect (real model will apply adstock)
                channel_effect = entity_sensitivities[channel] * (activities[channel] ** 0.5) * 0.3
                sales += channel_effect

            # Add noise
            sales += np.random.normal(0, 100)

            # Ensure non-negative
            sales = max(sales, 0)

            # Build row
            row = {
                "entity_id": entity_id,
                "period_start": period_start.strftime("%Y-%m-%d"),
                "sales": round(sales, 2)
            }

            # Add activity columns
            for channel in channels:
                row[f"act_{channel}"] = round(activities[channel], 2)

            # Add spend columns
            for channel in channels:
                row[f"spend_{channel}"] = round(spends[channel], 2)

            # Add control columns
            row["ctrl_price_index"] = round(price_index, 2)
            row["ctrl_competitor_activity"] = round(competitor_activity, 3)

            rows.append(row)

    df = pd.DataFrame(rows)

    # Sort by entity and date
    df = df.sort_values(["entity_id", "period_start"]).reset_index(drop=True)

    return df


if __name__ == "__main__":
    # Generate sample dataset
    df = generate_sample_mmm_dataset(
        n_weeks=104,
        n_entities=50,
        channels=["tv", "digital", "radio", "print", "social"],
        random_seed=42
    )

    # Save to CSV
    output_path = "mmm_sample.csv"
    df.to_csv(output_path, index=False)

    print(f"Generated sample dataset: {output_path}")
    print(f"Shape: {df.shape}")
    print(f"\nFirst few rows:")
    print(df.head())
    print(f"\nColumn types:")
    print(df.dtypes)
    print(f"\nSummary statistics:")
    print(df.describe())
