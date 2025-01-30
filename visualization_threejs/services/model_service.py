import wandb
from .grid_utils import hex_grid, cm_centers, neuron_centers

import wandb

def fetch_wandb_model(run_id):
    """Fetch a specific run from WandB and return processed model config."""
    entity, project = "sparsey-testing-system", "visualization-data-fetching"
    api = wandb.Api()

    if not run_id:
        raise ValueError("Received an empty run_id. Please provide a valid run ID.")

    try:
        print(f"Fetching WandB run: {run_id}")  # Debugging log
        run = api.run(f"{entity}/{project}/{run_id}")
    except wandb.errors.CommError as e:
        raise ValueError(f"Network error while fetching WandB run: {str(e)}")
    except wandb.errors.Error as e:
        raise ValueError(f"WandB API error: {str(e)}")
    except Exception as e:
        raise ValueError(f"Unexpected error: {str(e)}")

    model_config = getattr(run, "config", {}).get("model", {}).get("layers", {})

    if not model_config:
        raise ValueError(f"No layers found in WandB run {run_id}!")

    print(f"Successfully fetched model config for run: {run_id}")  # Debugging log
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

        mac_positions = hex_grid(rows, cols, hex_size=1.5)
        z = idx * 10

        for mac_x, mac_y in mac_positions:
            visualization_data.append({"type": "mac", "x": mac_x, "y": mac_y, "z": z})

            cm_positions = cm_centers(mac_x, mac_y, size=0.7, num_cms=num_cms)
            for cm_x, cm_y in cm_positions:
                visualization_data.append({"type": "cm", "x": cm_x, "y": cm_y, "z": z})

                neuron_positions = neuron_centers(cm_x, cm_y, radius=0.1, num_neurons=num_neurons)
                for neuron_x, neuron_y in neuron_positions:
                    visualization_data.append({"type": "neuron", "x": neuron_x, "y": neuron_y, "z": z})

    return visualization_data

def get_models():
    """Fetch available models from WandB."""
    entity, project = "sparsey-testing-system", "visualization-data-fetching"
    api = wandb.Api()

    runs = api.runs(f"{entity}/{project}")
    models = [{"label": run.name, "value": run.id} for run in runs]

    print(f"📌 Returning models: {models}")  # Debugging log
    return models
