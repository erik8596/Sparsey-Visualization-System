import sys
from pathlib import Path
from flask import jsonify, Response

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

from model.model_service import (
    get_projects,
    get_runs_from_project,
    fetch_wandb_model,
    process_visualization_data
)

class VisualizationController:
    """Controller handling visualization requests"""
    """Facade for visualization operations"""

    def __init__(self, entity: str = "sparsey-testing-system"):
        self.entity = entity

    def get_projects(self) -> Response:
        try:
            projects = get_projects()
            return jsonify(projects)
        except ValueError as e:
            return jsonify({"error": str(e)}), 500

    def get_runs(self, project_name: str) -> Response:
        if not project_name:
            return jsonify({"error": "No WandB project specified"}), 400

        try:
            runs = get_runs_from_project(self.entity, project_name)
            return jsonify(runs)
        except ValueError as e:
            return jsonify({"error": str(e)}), 500

    def visualize_run(self, run_id: str, project_name: str) -> Response:
        if not run_id:
            return jsonify({"error": "No WandB run selected"}), 400
        if not project_name:
            return jsonify({"error": "No WandB project specified"}), 400

        try:
            model_data = fetch_wandb_model(run_id, project_name)
            visualization_data = process_visualization_data(
                model_data["config"],
                model_data["mac_activations"]
            )
            return jsonify(visualization_data)
        except ValueError as e:
            return jsonify({"error": str(e)}), 500
