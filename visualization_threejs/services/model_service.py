import wandb
import numpy as np
from .grid_utils import hex_grid, cm_centers, neuron_centers
import re

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
    # Debug: print(f"Returning projects: {project_list}")
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
    # Debug: print(f"Returning runs for project '{project_name}': {run_list}")
    return run_list


def fetch_wandb_model(run_id, project_name):
    """Fetch a specific run from WandB and return processed model config and input dimensions."""
    entity = "sparsey-testing-system"  # Replace with your actual entity/team name
    api = wandb.Api()

    if not run_id:
        raise ValueError("Received an empty run_id. Please provide a valid run ID.")

    try:
        run = api.run(f"{entity}/{project_name}/{run_id}")
    except wandb.errors.CommError as e:
        raise ValueError(f"Network error while fetching WandB run: {str(e)}")
    except wandb.errors.Error as e:
        raise ValueError(f"WandB API error: {str(e)}")
    except Exception as e:
        raise ValueError(f"Unexpected error: {str(e)}")

    summary_data = getattr(run, "summary", {})
    print(f"Summary Data: {summary_data}")  # Debug log
    mac_activations = parse_mac_activations(summary_data)
    print("Parsed MAC Activations:", mac_activations)

    model_config = getattr(run, "config", {}).get("model", {}).get("layers", {})
    layer_1_params = model_config.get("layer_1", {}).get("params", {})
    input_dimensions = {
        "width": layer_1_params.get("prev_layer_mac_grid_num_cols", None),
        "height": layer_1_params.get("prev_layer_mac_grid_num_rows", None)
    }

    print(f"Model Config: {model_config}")  # Debug log
    print(f"Input Dimensions: {input_dimensions}")  # Debug log

    if not model_config:
        raise ValueError(f"No layers found in WandB run {run_id}!")

    return {
        "config": model_config,
        "input_dimensions": input_dimensions,
        "mac_activations": mac_activations
    }


def process_visualization_data(model_config, mac_activations):
    """Process model configuration and MAC activations to prepare visualization data."""
    visualization_data = []

    for idx, (layer_name, layer_dict) in enumerate(model_config.items()):
        params = layer_dict.get("params", {})
        rows = params.get("mac_grid_num_rows", 1)
        cols = params.get("mac_grid_num_cols", 1)
        num_cms = params.get("num_cms_per_mac", 1)
        num_neurons = params.get("num_neurons_per_cm", 1)

        z = idx * 10

        # Retrieve MAC activations for this layer
        layer_activation_dict = mac_activations.get(layer_name, {})

        mac_positions = hex_grid(rows, cols, hex_size=1.5)

        # ----- MAC Loop -----
        for i, (x, y) in enumerate(mac_positions, start=1):
            is_active = layer_activation_dict.get(i, 0) == 1
            visualization_data.append({
                "type": "mac",
                "x": x,
                "y": y,
                "z": z,
                "active": is_active
            })

        # ----- CM Logic -----
        if num_cms > 1:
            angles_cms = np.linspace(0, 2 * np.pi, num_cms, endpoint=False)
            offsets_cms = np.stack([np.cos(angles_cms), np.sin(angles_cms)], axis=1) * 1
            all_cm_positions = mac_positions[:, None, :] + offsets_cms[None, :, :]
        else:
            all_cm_positions = mac_positions[:, None, :]

        flat_cm_positions = all_cm_positions.reshape(-1, 2)
        for (cx, cy) in flat_cm_positions:
            visualization_data.append({
                "type": "cm",
                "x": cx,
                "y": cy,
                "z": z
            })

        # ----- Neuron Logic -----
        if num_neurons > 1:
            angles_neurons = np.linspace(0, 2 * np.pi, num_neurons, endpoint=False)
            offsets_neurons = np.stack([np.cos(angles_neurons), np.sin(angles_neurons)], axis=1) * 0.3
            all_neuron_positions = all_cm_positions[:, :, None, :] + offsets_neurons[None, None, :, :]
        else:
            all_neuron_positions = all_cm_positions[:, :, None, :]

        flat_neuron_positions = all_neuron_positions.reshape(-1, 2)
        for (nx, ny) in flat_neuron_positions:
            visualization_data.append({
                "type": "neuron",
                "x": nx,
                "y": ny,
                "z": z
            })

    # ----- Input Dimensions from layer_1 for convenience -----
    layer_1_params = model_config.get("layer_1", {}).get("params", {})
    input_dimensions = {
        "width": layer_1_params.get("prev_layer_mac_grid_num_cols", None),
        "height": layer_1_params.get("prev_layer_mac_grid_num_rows", None)
    }

    return {
        "layers": visualization_data,
        "input_dimensions": input_dimensions
    }


def parse_mac_activations(summary_data):
    """
    Parse summary_data for keys like 'num_activations/layer_1/mac_2'
    and return a dict of { 'layer_1': {2: 0, ...}, ... }.
    """
    mac_activations = {}
    pattern = re.compile(r"^num_activations/layer_(\d+)/mac_(\d+)$")

    for key, val in summary_data.items():
        match = pattern.match(key)
        if match:
            layer_idx = match.group(1)
            mac_idx = int(match.group(2))
            layer_name = f"layer_{layer_idx}"

            if layer_name not in mac_activations:
                mac_activations[layer_name] = {}

            mac_activations[layer_name][mac_idx] = val

    return mac_activations
