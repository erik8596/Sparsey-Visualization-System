import os
from flask import Flask, render_template, request, jsonify
from services.model_service import (
    get_projects,
    get_runs_from_project,
    fetch_wandb_model,
    process_visualization_data
)

app = Flask(__name__, template_folder='templates')


@app.route("/")
def index():
    """Serve the Three.js visualization page."""
    return render_template("index.html")


@app.route("/get_projects", methods=["GET"])
def get_projects_route():
    """Fetch available projects from WandB."""
    try:
        projects = get_projects()
        return jsonify(projects)
    except ValueError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get_runs", methods=["POST"])
def get_runs_route():
    """Fetch runs within a specific project."""
    data = request.get_json()
    project_name = data.get("project")
    if not project_name:
        return jsonify({"error": "No WandB project specified"}), 400

    entity = "sparsey-testing-system"
    try:
        runs = get_runs_from_project(entity, project_name)
        return jsonify(runs)
    except ValueError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/visualize", methods=["POST"])
def visualize():
    """Visualize a specific run."""
    data = request.get_json()
    run_id = data.get("run_id")
    project_name = data.get("project")

    if not run_id:
        return jsonify({"error": "No WandB run selected"}), 400

    if not project_name:
        return jsonify({"error": "No WandB project specified"}), 400

    try:
        # 1. Fetch the model config and MAC activations from WandB.
        model_data = fetch_wandb_model(run_id, project_name)
        model_config = model_data["config"]
        mac_activations = model_data["mac_activations"]

        # 2. Process visualization data using the input layer logic.
        visualization_data = process_visualization_data(model_config, mac_activations)

        # 3. Build the response payload with layers and input dimensions.
        response_data = {
            "layers": visualization_data["layers"],
            "input_dimensions": model_data["input_dimensions"]
        }

        return jsonify(response_data)

    except ValueError as e:
        return jsonify({"error": str(e)}), 500
