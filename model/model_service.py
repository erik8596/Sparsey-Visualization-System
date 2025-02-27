import re
import wandb
import numpy as np
from .factories import MACFactory, CMFactory, NeuronFactory
from .components import MAC, CM, Neuron
from .parsers.mac_activation_parser import MACActivationParser
from .processors import LayeredVisualizationStrategy

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
    mac_parser = MACActivationParser()
    mac_activations = mac_parser.parse(summary_data)
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
    """Process model configuration using Strategy pattern"""
    strategy = LayeredVisualizationStrategy()
    return strategy.process(model_config, mac_activations)

