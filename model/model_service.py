import re
import wandb
import numpy as np
from .factories import MACFactory, CMFactory, NeuronFactory
from .components import MAC, CM, Neuron

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
    """Process model configuration using Factory and Composite patterns."""
    mac_factory = MACFactory()
    cm_factory = CMFactory()
    neuron_factory = NeuronFactory()

    visualization_data = []

    for idx, (layer_name, layer_dict) in enumerate(model_config.items()):
        params = layer_dict.get("params", {})
        z = idx * 10

        # Get MAC positions
        mac_positions = mac_factory.calculate_positions(
            rows=params.get("mac_grid_num_rows", 1),
            cols=params.get("mac_grid_num_cols", 1)
        )

        layer_activation_dict = mac_activations.get(layer_name, {})

        # Create MACs
        macs = []
        for i, (x, y) in enumerate(mac_positions, start=1):
            is_active = layer_activation_dict.get(i, 0) == 1
            mac = mac_factory.create_component(x, y, z, active=is_active)
            macs.append(mac)

            # Get CM positions for this MAC
            cm_positions = cm_factory.calculate_positions(
                np.array([[x, y]]),  # Single MAC position
                params.get("num_cms_per_mac", 1)
            )

            # Create CMs
            for cm_pos in cm_positions.reshape(-1, 2):
                cm = cm_factory.create_component(cm_pos[0], cm_pos[1], z)
                mac.add_cm(cm)

                # Get neuron positions for this CM
                neuron_positions = neuron_factory.calculate_positions(
                    np.array([cm_pos]),  # Single CM position
                    params.get("num_neurons_per_cm", 1)
                )

                # Create neurons
                for neuron_pos in neuron_positions.reshape(-1, 2):
                    neuron = neuron_factory.create_component(
                        neuron_pos[0],
                        neuron_pos[1],
                        z
                    )
                    cm.add_neuron(neuron)

        # Collect visualization data
        for mac in macs:
            visualization_data.extend(mac.get_visualization_data())

    return {
        "layers": visualization_data,
        "input_dimensions": {
            "width": model_config.get("layer_1", {}).get("params", {}).get("prev_layer_mac_grid_num_cols"),
            "height": model_config.get("layer_1", {}).get("params", {}).get("prev_layer_mac_grid_num_rows")
        }
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
