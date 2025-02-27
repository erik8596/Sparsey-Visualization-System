import wandb
import numpy as np
from .grid_utils import hex_grid, place_cms_in_mac, place_neurons_in_cm
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
    """
    Example usage of place_cms_in_mac and place_neurons_in_cm
    to ensure all CMs fit inside a MAC boundary without overlap,
    and all neurons fit inside a CM boundary without overlap.
    """
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

        # 1) Place MACs in a hex grid
        mac_positions = hex_grid(rows, cols, hex_size=1.5)

        # For each MAC in this layer
        for i, (mac_x, mac_y) in enumerate(mac_positions, start=1):
            is_active = layer_activation_dict.get(i, 0) == 1
            visualization_data.append({
                "type": "mac",
                "x": mac_x,
                "y": mac_y,
                "z": z,
                "active": is_active
            })

            # 2) Place CMs inside the MAC
            #    If your MAC side is 2.0 in main.js, the bounding circle radius is ~2.0
            #    Adjust gap as needed so they don't overlap.
            mac_radius = 2.0
            cm_radius = 0.5
            cm_gap = 0.2

            cm_positions = place_cms_in_mac(
                mac_center_x=mac_x,
                mac_center_y=mac_y,
                mac_radius=mac_radius,
                num_cms=num_cms,
                cm_radius=cm_radius,
                gap=cm_gap
            )

            for (cm_x, cm_y) in cm_positions:
                visualization_data.append({
                    "type": "cm",
                    "x": cm_x,
                    "y": cm_y,
                    "z": z
                })

                # 3) Place neurons inside the CM
                #    If your CM side is 0.5 in main.js, the bounding circle radius is ~0.5
                #    Adjust gap so they don't overlap
                neuron_positions = place_neurons_in_cm(
                    cm_center_x=cm_x,
                    cm_center_y=cm_y,
                    cm_radius=cm_radius,      # same 0.5
                    num_neurons=num_neurons,
                    neuron_radius=0.10,       # if you drawCircle(shape, 0.10)
                    gap=0.1
                )
                for (nx, ny) in neuron_positions:
                    visualization_data.append({
                        "type": "neuron",
                        "x": nx,
                        "y": ny,
                        "z": z
                    })

    # Retrieve input dimensions from layer_1 for convenience
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
