import sys
from pathlib import Path
from flask import jsonify, Response

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

from model.wandb import WandBFacade
from model.processors import LayeredVisualizationStrategy

lvs = LayeredVisualizationStrategy()
wbf = WandBFacade()
class VisualizationController:
    """Controller handling visualization requests"""
        
    def visualize_run(self, run_id: str, project_name: str) -> Response:
        if not run_id:
            return jsonify({"error": "No WandB run selected"}), 400
        if not project_name:
            return jsonify({"error": "No WandB project specified"}), 400

        try:
            model_data = wbf.get_processed_model_config(
                run_id, 
                project_name
            )
            visualization_data = lvs.process(
                model_data.layers,
                model_data.mac_activations
            )
            return jsonify(visualization_data)
        except ValueError as e:
            return jsonify({"error": str(e)}), 500
