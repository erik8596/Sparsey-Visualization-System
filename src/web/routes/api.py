from flask import Blueprint, jsonify
from src.core.model.wandb.wandb_facade import WandBFacade
from src.core.model.processors.layered_strategy import LayeredVisualizationStrategy
from src.core.model.parsers.weight_connection_parser import WeightedConnectionsParser
import os

api = Blueprint('api', __name__, url_prefix='/api')

wbf = WandBFacade() # singleton instance
lvs = LayeredVisualizationStrategy()
DATA_ARTIFACT_STORE_PATH = os.environ.get('DATA_ARTIFACT_STORE_PATH', "data/artifact_store")

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
        return jsonify({'step_history': history})
    except Exception as e:
        print(f"API: Error fetching run history - {str(e)}")
        return jsonify({'error': str(e), 'history': []}), 500

@api.route('/<project_name>/<run_id>/visualize', methods=['GET'])
def visualize(project_name, run_id):
    """Fetches the visualization data for a specific run."""
    try:
        model_data = wbf.get_processed_model_config(run_id, project_name)
        if not model_data or not model_data.layers:
            return jsonify({"error": "No model configuration data available"}), 500

        visualization_data = lvs.process(
            model_data.layers,
            model_data.mac_activations,
            model_data.input_activations,
            model_data.neuron_activations  # Pass neuron activations
        )
        return jsonify(visualization_data)

    except Exception as e:
        print(f"Error during visualization: {str(e)}")
        return jsonify({"error": str(e)}), 500

@api.route('/<project_name>/<run_id>/<int:step>/weight_connections', methods=['GET'])
def get_weight_connections(project_name, run_id, step: int):
    """
    Fetches weight connections for a specific run and step.
    """
    try:
        # Ensure the correct model config and artifacts are loaded for this run
        model_config = wbf.get_processed_model_config(run_id=run_id, project_name=project_name)
        if not model_config or not model_config.layers:
             return jsonify({"error": "Failed to load model configuration for the run"}), 500
        
        # Ensure weight artifacts are loaded if not already present in config
        # The parser's __init__ will handle calling find_weight_artifacts if needed.
        if not model_config.weighted_connections:
             # find_weight_artifacts downloads *all* steps, not just one.
             wbf.find_weight_artifacts(run_id=run_id, project_name=project_name)
             # Refresh model_config view after potential artifact loading
             model_config = wbf.mconf 
             if not model_config.weighted_connections:
                 # If still no connections after trying to fetch, then they don't exist
                 return jsonify({'error': f'No weight artifacts found for run {run_id} after checking WandB.'}), 404

        # Initialize the parser now that wbf state is updated for the specific run
        wcp = WeightedConnectionsParser(wbf)

        # Parse the specific step. parse() will raise ValueError if step_int not found.
        weight_connections = wcp.parse(step)
        return jsonify(weight_connections)
        
    except ValueError as ve: # Catch specific expected errors like missing step from parse()
        print(f"API: Value error fetching weight connections - {str(ve)}")
        # Check if the error message indicates the step wasn't found
        if f"step {step}" in str(ve) and "Available steps" in str(ve):
             return jsonify({'error': str(ve)}), 404 # Not found
        else:
            # Handle other potential ValueErrors (e.g., config issues within parse)
            return jsonify({'error': f'Configuration or data error: {str(ve)}'}), 500
            
    except Exception as e:
        print(f"API: Unexpected error fetching weight connections - {str(e)}")
        # Log the full traceback for debugging
        import traceback
        traceback.print_exc()
        return jsonify({'error': "An internal error occurred"}), 500

@api.route('/status', methods=['GET'])
def get_status():
    """
    Fetches a status of the current W&B project and run.
    """
    return jsonify(wbf.status())

