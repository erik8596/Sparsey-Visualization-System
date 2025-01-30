import os
import sys
import wandb
from flask import Flask, render_template, request, jsonify
from services.grid_utils import hex_grid, cm_centers, neuron_centers
from services.model_service import fetch_wandb_model, process_visualization_data, get_models

app = Flask(__name__, template_folder='templates')


@app.route("/")
def index():
    """Serve the Three.js visualization page."""
    return render_template("index.html")

@app.route("/get_models")
def get_models_route():
    """Fetch available models from WandB."""
    models = get_models()
    return jsonify(models)


@app.route("/visualize", methods=["POST"])
def visualize():
    model_id = request.json.get("model")
    if not model_id:
        return jsonify({"error": "No WandB run selected"}), 400

    try:
        model_config = fetch_wandb_model(model_id)
    except ValueError as e:
        return jsonify({"error": str(e)}), 500

    visualization_data = process_visualization_data(model_config)
    return jsonify({"layers": visualization_data})




if __name__ == "__main__":
    app.run(debug=True)
