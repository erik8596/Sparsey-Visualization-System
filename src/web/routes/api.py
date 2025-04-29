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

        # Log model data components
        print("\n=== MODEL DATA BEFORE PROCESSING ===")
        print(f"- Has layers: {bool(model_data.layers)} ({len(model_data.layers) if model_data.layers else 0} layers)")
        print(f"- Has input_activations: {bool(model_data.input_activations)} ({len(model_data.input_activations) if model_data.input_activations else 0} items)")
        print(f"- Has MAC activations: {bool(model_data.mac_activations)} ({len(model_data.mac_activations) if model_data.mac_activations else 0} layers)")
        print(f"- Has neuron activations: {bool(model_data.neuron_activations)} ({len(model_data.neuron_activations) if model_data.neuron_activations else 0} layers)")

        # DEBUG: Show actual content of activation data
        print("\n=== ACTIVATION DATA STRUCTURE ===")
        print("Input activations format:", type(model_data.input_activations))
        if model_data.input_activations:
            print("Sample input activation:", next(iter(model_data.input_activations.items())))

        print("\nMAC activations format:", type(model_data.mac_activations))
        if model_data.mac_activations:
            print("MAC activations keys:", list(model_data.mac_activations.keys())[:5])
            layer_key = next(iter(model_data.mac_activations.keys()))
            print(f"Sample MAC activation layer '{layer_key}':", next(iter(model_data.mac_activations[layer_key].items())))

        print("\nNeuron activations format:", type(model_data.neuron_activations))
        if model_data.neuron_activations:
            print("Neuron activations keys:", list(model_data.neuron_activations.keys())[:5])

        visualization_data = lvs.process(
            model_data.layers,
            model_data.mac_activations,
            model_data.input_activations,
            model_data.neuron_activations
        )

        # After processing, check the actual structure of visualization_data
        print("\n=== VISUALIZATION DATA STRUCTURE ===")
        print("Top-level keys:", list(visualization_data.keys()))
        if 'input_activations' in visualization_data:
            print("Input activations type:", type(visualization_data['input_activations']))
            print("Input activations content:", visualization_data['input_activations'])

        # After processing, extract each type of activation into separate dictionaries
        input_activations_dict = {}
        mac_activations_dict = {}
        neuron_activations_dict = {}

        # Extract input activations
        input_keys = [k for k in visualization_data.keys() if k.startswith('input_activations/')]
        for key in input_keys:
            input_activations_dict[key] = visualization_data[key]

        # Extract MAC activations (using precise pattern to avoid confusion with neuron activations)
        mac_keys = [k for k in visualization_data.keys() if k.startswith('neuron_activations/layer_')
                    and '/mac_' in k and '/cm_' not in k]
        for key in mac_keys:
            mac_activations_dict[key] = visualization_data[key]

        # Extract detailed neuron activations
        detailed_neuron_keys = [k for k in visualization_data.keys()
                               if k.startswith('neuron_activations/') and '/cm_' in k and '/neuron_' in k]
        for key in detailed_neuron_keys:
            neuron_activations_dict[key] = visualization_data[key]

        # Log detailed information about each activation type
        print("\n=== DATA SENT TO CLIENT (SEPARATED) ===")
        print(f"- Input activations: {len(input_keys)} found")
        if input_keys:
            print(f"  Sample: {input_keys[0]} = {visualization_data[input_keys[0]]}")

        print(f"- MAC activations: {len(mac_keys)} found")
        if mac_keys:
            print(f"  Sample: {mac_keys[0]} = {visualization_data[mac_keys[0]]}")

        print(f"- Detailed neuron activations: {len(detailed_neuron_keys)} found")
        if detailed_neuron_keys:
            print(f"  Sample: {detailed_neuron_keys[0]} = {visualization_data[detailed_neuron_keys[0]]}")

        print("=====================================\n")

        # Create the response structure
        response = {
            "layers": visualization_data.get("layers", []),
            "input_dimensions": visualization_data.get("input_dimensions", {}),
            "input_activations": {}
        }

        # Extract input activations as a simple dictionary (pixel_id: value)
        for key in input_keys:
            # Convert keys like "input_activations/pixel_42" to just "42"
            pixel_id = int(key.split('_')[-1])
            response["input_activations"][pixel_id] = visualization_data[key]

        # Add MAC and neuron activations with the correct key names (no _data suffix)
        response["mac_activations"] = mac_activations_dict
        response["neuron_activations"] = neuron_activations_dict

        return jsonify(response)

    except Exception as e:
        print(f"Error during visualization: {str(e)}")
        return jsonify({"error": str(e)}), 500

@api.route('/<project_name>/<run_id>/<int:step>/weight_connections', methods=['GET'])
def get_weight_connections(project_name, run_id, step: int):
    """
    Fetches and parses weight connections for a specific run and step.
    Uses caching and loads only the required artifact step from W&B if necessary.
    """
    try:
        # 1. Set W&B Facade context to the correct run
        #    First, ensure the facade knows about runs in this project
        wbf.load_runs_from_project(project_name=project_name)
        #    Then, attempt to update to the specific run
        if not wbf.update_run(run_id=run_id, project_name=project_name):
            return jsonify({"error": f"Run ID '{run_id}' not found in project '{project_name}'"}), 404

        # 2. Ensure model configuration (layer/input dims) is loaded for the parser
        model_config = wbf.get_processed_model_config(run_id=run_id, project_name=project_name)
        if not model_config or not model_config.layers:
             return jsonify({"error": "Failed to load model configuration for the run"}), 500

        # 3. Get the specific step data (loads from cache or W&B if needed)
        # This method now loads the data into wbf.mconf.weighted_connections[step]
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

@api.route('/status', methods=['GET'])
def get_status():
    """
    Fetches a status of the current W&B project and run.
    """
    return jsonify(wbf.status())
