from flask import Blueprint, jsonify
from src.sparseypy.wandb.wandb_facade import WandBFacade

api = Blueprint('api', __name__, url_prefix='/api')

wandbf = WandBFacade()

@api.route('/projects', methods=['GET'])
def get_projects():
    try:
        projects = wandbf.load_projects()
        if projects is None:
            print("API: Warning - load_projects() returned None")
            return jsonify({'projects': [], 'warning': 'No projects found'})
            
        print(f"API: Successfully loaded {len(projects)} projects")
        return jsonify({'projects': projects})
    except Exception as e:
        print(f"API: Error loading projects - {str(e)}")
        return jsonify({'error': str(e), 'projects': []}), 500
    

@api.route('/<project_name>/runs', methods=['GET'])
def get_project_runs(project_name):
    try:
        project_runs = wandbf.load_project_runs(project_name=project_name)
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
    try:
        model_config = wandbf.fetch_model_config(run_id=run_id, project_name=project_name)
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
    try:
        wandbf.update_project(project_name=project_name)
        return jsonify({'message': 'Project updated successfully'})
    except Exception as e:
        print(f"API: Error updating project - {str(e)}")
        return jsonify({'error': str(e), 'message': 'Failed to update project'}), 500
    
@api.route('update-run/<project_name>/<run_id>', methods=['POST'])
def update_run(project_name, run_id):
    try:
        wandbf.update_run(run_id=run_id, project_name=project_name)
        return jsonify({'message': 'Run updated successfully'})
    except Exception as e:
        print(f"API: Error updating run - {str(e)}")
        return jsonify({'error': str(e), 'message': 'Failed to update run'}), 500