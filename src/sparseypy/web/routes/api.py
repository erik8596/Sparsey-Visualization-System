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
        project_runs = wandbf.load_runs_by_project(project_name=project_name)
        if project_runs is None:
            print("API: Warning - load_runs_by_project() returned None")
            return jsonify({'project_runs': [], 'warning': 'No project runs found'})
        
        print(f"API: Successfully loaded {len(project_runs)} projects")
        return jsonify({'project_runs': project_runs})
    except Exception as e:
        print(f"API: Error loading project runs - {str(e)}")
        return jsonify({'error': str(e), 'project_runs': []}), 500