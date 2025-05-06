from flask import Blueprint, jsonify
from src.core.model.wandb.wandb_facade import WandBFacade
from src.core.model.processors.layered_strategy import LayeredVisualizationStrategy
from src.core.model.parsers.weight_connection_parser import WeightedConnectionsParser
from src.core.model.parsers.mac_activation_parser import MACActivationParser
from src.core.model.parsers.input_activation_parser import InputActivationParser
from src.core.model.parsers.activation_probabilities_parser import ActivationProbabilitiesParser

import os

api = Blueprint('api', __name__, url_prefix='/api')

wbf = WandBFacade() # singleton instance
lvs = LayeredVisualizationStrategy()
DATA_ARTIFACT_STORE_PATH = os.environ.get('DATA_ARTIFACT_STORE_PATH', "data/artifact_store")

# Define metric prefixes and exact keys to exclude from the generic /history endpoint
EXCLUDED_HISTORY_PREFIXES = [
    # metrics either not being processed or being routed differently
    'activation_probabilities/', # Exclude all nested probability metrics
    'activation_probabilities',
    'weights',                 # Assuming weights are logged like weights/layer_1/...
    'num_activations/',         # Assuming num_activations are logged like num_activations/layer_1/...
    'match_accuracy',           # Exclude this specific metric
    'basis_average',            # Exclude this specific metric
    'basis_set_size',           # Exclude this specific metric
    'feature_coverage',
    # metadata
    '_runtime',
    '_step',
    '_timestamp',
    # Add other prefixes (ending with '/') or exact keys here
]

@api.route('/')
def index():
    return {"message": "API is working"}

@api.route('/projects', methods=['GET'])
def get_projects():
    """
    Retrieves all available W&B projects for default entity.
    Returns:
        200: JSON containing list of projects
        500: Error message if project loading fails
    """
    try:
        projects = wbf.load_projects()
        if projects is None:
            print("API: Warning - load_projects() returned None")
            return jsonify({"projects": []})

        print(f"API: Successfully loaded {len(projects)} projects")
        return jsonify({"projects": projects})
    except Exception as e:
        print(f"API: Error loading projects - {str(e)}")
        return jsonify({'error': str(e)}), 500


@api.route('/<project_name>/runs', methods=['GET'])
def get_project_runs(project_name):
    """
    Retrieves all runs for a specific W&B project.
    Args:
        project_name (str): Name of the W&B project
    Returns:
        200: JSON containing list of project runs
        500: Error message if run loading fails
    """
    try:
        project_runs = wbf.load_runs_from_project(project_name=project_name)
        if project_runs is None:
            print("API: Warning - load_runs_by_project() returned None")
            return jsonify({'project_runs': [], 'warning': 'No project runs found'})

        print(f"API: Successfully loaded {len(project_runs)} project runs.")
        return jsonify({'project_runs': project_runs})
    except Exception as e:
        print(f"API: Error loading project runs - {str(e)}")
        return jsonify({'error': str(e), 'project_runs': []}), 500

@api.route('/<project_name>/<run_id>/model_config', methods=['GET'])
def get_model_config(project_name, run_id):
    """
    Fetches model configuration for a specific run in a project.
    Args:
        project_name (str): Name of the W&B project
        run_id (str): ID of the specific run
    Returns:
        200: JSON containing model configuration
        500: Error message if config fetching fails
    """
    try:
        model_config = wbf.fetch_model_config(run_id=run_id, project_name=project_name)
        if model_config is None:
            print("API: Warning - fetch_model() returned None")
            return jsonify({'model_config': [], 'warning': 'No model config found'})

        print(f"API: Successfully loaded {model_config.get('model').get('model_name')}.")
        return jsonify({'model_config': model_config})
    except Exception as e:
        print(f"API: Error fetching model config - {str(e)}")
        return jsonify({'error': str(e), 'model_config': []}), 500

@api.route('update-project/<project_name>', methods=['POST'])
def update_project(project_name):
    """
    Updates the local cache for a specific W&B project.
    Args:
        project_name (str): Name of the W&B project to update
    Returns:
        200: Success message
        500: Error message if update fails
    """
    try:
        wbf.update_project(project_name=project_name)
        return jsonify({'message': 'Project updated successfully'})
    except Exception as e:
        print(f"API: Error updating project - {str(e)}")
        return jsonify({'error': str(e), 'message': 'Failed to update project'}), 500

@api.route('update-run/<project_name>/<run_id>', methods=['POST'])
def update_run(project_name, run_id):
    """
    Updates the local cache for a specific run in a project.
    Args:
        project_name (str): Name of the W&B project
        run_id (str): ID of the run to update
    Returns:
        200: Success message
        500: Error message if update fails
    """
    try:
        wbf.update_run(run_id=run_id, project_name=project_name)
        return jsonify({'message': 'Run updated successfully'})
    except Exception as e:
        print(f"API: Error updating run - {str(e)}")
        return jsonify({'error': str(e), 'message': 'Failed to update run'}), 500

@api.route('/<project_name>/<run_id>/history', methods=['GET'])
def get_run_history(project_name, run_id):
    """
    Fetches the history of a specific run in a project.
    """
    try:
        history = wbf.fetch_run_history(
            run_id=run_id,
            project_name=project_name,
        )

        if history is None or not history: # Check if history is None or empty
            return jsonify({'error': 'No history found for run or history is empty'}), 404

        # Filter the history
        filtered_history = {}
        for step, step_data in history.items():
            filtered_step_data = {
                key: value for key, value in step_data.items()
                # Keep keys starting with '_' OR keys that DO NOT start with any excluded prefix
                if key.startswith('_') or not any(key.startswith(prefix) for prefix in EXCLUDED_HISTORY_PREFIXES)
            }
            # Only add step if it still has relevant data after filtering
            # (excluding steps that *only* contained excluded metrics or underscore keys)
            if any(not k.startswith('_') for k in filtered_step_data.keys()):
                 filtered_history[step] = filtered_step_data

        return jsonify({'step_history': filtered_history})
    except Exception as e:
        print(f"API: Error fetching run history - {str(e)}")
        return jsonify({'error': str(e), 'history': []}), 500


@api.route('/<project_name>/<run_id>/visualize', methods=['GET'])
def visualize(project_name, run_id):
    """
    Fetches the visualization data for a specific run, but now with
    MAC activations pulled from step 0 of the run history.
    """
    try:
        # 1) Load the static model config (layers, dims, legacy activations)
        model_data = wbf.get_processed_model_config(run_id, project_name)
        if not model_data or not model_data.layers:
            return jsonify({"error": "No model configuration data available"}), 500

        # 2) Fetch the full run history once
        history = wbf.fetch_run_history(run_id=run_id, project_name=project_name)

        # 3) Override MAC activations with step-0 values
        mac_parser      = MACActivationParser()
        mac_acts_step0  = mac_parser.parse_from_history(history, step=0)
        model_data.mac_activations = mac_acts_step0

        # 4) (Also update input activations from history if you like)
        input_parser       = InputActivationParser()
        input_acts_step0   = input_parser.parse_from_history(history, step=0)
        model_data.input_activations = input_acts_step0

        # 5) Finally hand off to your Three.js strategy
        visualization_data = lvs.process(
            model_data.layers,
            model_data.mac_activations,
            model_data.input_activations,
            model_data.neuron_activations
        )
        return jsonify(visualization_data)

    except Exception as e:
        print(f"Error during visualization: {e}")
        return jsonify({"error": str(e)}), 500

@api.route('/<project_name>/<run_id>/<int:step>/weight_connections', methods=['GET'])
def get_weight_connections(project_name, run_id, step: int):
    """
    Fetches and parses weight connections for a specific run and step.
    Uses caching and loads only the required artifact step from W&B if necessary.
    """
    if project_name is None or run_id is None or step is None:
        return jsonify({'error': 'Missing project name, run ID, or step'}), 400

    if project_name not in wbf.projects_list:
        return jsonify({'error': f'Project {project_name} not found in entity {wbf.entity}'}), 404

    if run_id not in [run['id'] for run in wbf.project_runs]:
        return jsonify({'error': f'Run {run_id} not found in project {project_name}'}), 404

    try:
        step_data = wbf.get_weighted_connections_for_step(step)
        if step_data is None:
            # Error message/reason is printed by the facade method
            return jsonify({'error': f'Weighted connections for step {step} not found or could not be loaded.'}), 404

        # 4. Initialize the parser (it will find config and step data in wbf.mconf)
        wcp = WeightedConnectionsParser(wbf)

        # 5. Parse the specific step data (already loaded into memory)
        parsed_connections = wcp.parse(step)
        return jsonify(parsed_connections)

    except ValueError as ve: # Catch specific expected errors from parser
        print(f"API: Value error processing weight connections - {str(ve)}")
        return jsonify({'error': f'Configuration or data error during parsing: {str(ve)}'}), 500

    except Exception as e:
        print(f"API: Unexpected error fetching weight connections for step {step} - {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': "An internal error occurred"}), 500

@api.route('/<project_name>/<run_id>/<step>/activation_probabilities', methods=['GET'])
def get_activation_probabilities(project_name, run_id, step):
    """Get MAC activation probabilities for a specific step"""
    try:
        # Get the activation probabilities parser
        parser = ActivationProbabilitiesParser(wbf)
        # Parse the probabilities
        probabilities = parser.parse()
        # Get the probabilities for the specified step
        step_probs = parser.get_step_probabilities(int(step))
        # Return the probabilities
        return jsonify(step_probs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api.route('/status', methods=['GET'])
def get_status():
    """
    Fetches a status of the current W&B project and run.
    """
    return jsonify(wbf.status())
