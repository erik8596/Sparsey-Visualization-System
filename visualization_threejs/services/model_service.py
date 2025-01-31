# services/model_service.py

import wandb
import numpy as np
from .grid_utils import hex_grid, cm_centers, neuron_centers

def get_projects():
    """Fetch available projects from WandB."""
    entity = "sparsey-testing-system"  # Replace with your actual entity/team name
    api = wandb.Api()

    try:
        projects = api.projects(entity=entity)
    except wandb.errors.CommError as e:
        raise ValueError(f"Network error while fetching projects: {str(e)}")
    except wandb.errors.Error as e:
        raise ValueError(f"WandB API error: {str(e)}")
    except Exception as e:
        raise ValueError(f"Unexpected error: {str(e)}")

    project_list = [{"label": project.name, "value": project.name} for project in projects]
    print(f"📌 Returning projects: {project_list}")  # Debugging log
    return project_list


def get_runs_from_project(entity, project_name):
    """Fetch all run IDs and names from a specific project."""
    api = wandb.Api()

    try:
        runs = api.runs(f"{entity}/{project_name}")
    except wandb.errors.CommError as e:
        raise ValueError(f"Network error while fetching runs: {str(e)}")
    except wandb.errors.Error as e:
        raise ValueError(f"WandB API error: {str(e)}")
    except Exception as e:
        raise ValueError(f"Unexpected error: {str(e)}")

    run_list = [{"label": run.name, "value": run.id} for run in runs]
    print(f"📌 Returning runs for project '{project_name}': {run_list}")  # Debugging log
    return run_list


def fetch_wandb_model(run_id, project_name):
    """Fetch a specific run from WandB and return processed model config."""
    entity = "sparsey-testing-system"  # Replace with your actual entity/team name
    api = wandb.Api()

    if not run_id:
        raise ValueError("Received an empty run_id. Please provide a valid run ID.")

    try:
        print(f"Fetching WandB run: {run_id} from project: {project_name}")  # Debugging log
        run = api.run(f"{entity}/{project_name}/{run_id}")
    except wandb.errors.CommError as e:
        raise ValueError(f"Network error while fetching WandB run: {str(e)}")
    except wandb.errors.Error as e:
        raise ValueError(f"WandB API error: {str(e)}")
    except Exception as e:
        raise ValueError(f"Unexpected error: {str(e)}")

    model_config = getattr(run, "config", {}).get("model", {}).get("layers", {})

    if not model_config:
        raise ValueError(f"No layers found in WandB run {run_id}!")

    print(f"✅ Successfully fetched model config for run: {run_id}")  # Debugging log
    return model_config


def process_visualization_data(model_config):
    """Convert model_config into visualization format for Three.js."""
    visualization_data = []

    for idx, (layer_name, layer) in enumerate(model_config.items()):
        params = layer.get("params", {})
        rows = params.get("mac_grid_num_rows", 1)
        cols = params.get("mac_grid_num_cols", 1)
        num_cms = params.get("num_cms_per_mac", 1)
        num_neurons = params.get("num_neurons_per_cm", 1)

        z = idx * 10  # Layer depth

        # mac positions (M, 2) where M = rows*cols
        mac_positions = hex_grid(rows, cols, hex_size=1.5)

        # mac dicts
        visualization_data.extend(
            {"type": "mac", "x": x, "y": y, "z": z}
            for x, y in mac_positions
        )

        if num_cms > 1:
            angles_cms = np.linspace(0, 2 * np.pi, num_cms, endpoint=False)

            offsets_cms = np.stack(
                [np.cos(angles_cms), np.sin(angles_cms)],
                axis=1
            ) * 0.7

            all_cm_positions = mac_positions[:, None, :] + offsets_cms[None, :, :]
        else:
            # if only 1 cm
            all_cm_positions = mac_positions[:, None, :]

        flat_cm_positions = all_cm_positions.reshape(-1, 2)

        # build CM dicts
        visualization_data.extend(
            {"type": "cm", "x": x, "y": y, "z": z}
            for x, y in flat_cm_positions
        )

        # neuron positions for each cm (vectorized)
        if num_neurons > 1:
            angles_neurons = np.linspace(
                0,
                2 * np.pi,
                num_neurons,
                endpoint=False
            )

            offsets_neurons = np.stack(
                [np.cos(angles_neurons), np.sin(angles_neurons)],
                axis=1
            ) * (2 * 0.1)

            all_neuron_positions = all_cm_positions[:, :, None, :] + offsets_neurons[None, None, :, :]

        else:
            # if only 1 nueron
            all_neuron_positions = all_cm_positions[:, :, None, :]

        # flatten to shape (M*num_cms*num_neurons, 2)
        flat_neuron_positions = all_neuron_positions.reshape(-1, 2)

        # build neuron dicts
        visualization_data.extend(
            {"type": "neuron", "x": x, "y": y, "z": z}
            for x, y in flat_neuron_positions
        )
    return visualization_data
