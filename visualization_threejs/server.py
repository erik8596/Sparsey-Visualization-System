# server.py

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

    entity = "sparsey-testing-system"  # Replace with your actual entity/team name
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
    project_name = data.get("project")  # Pass project name to locate the run

    if not run_id:
        return jsonify({"error": "No WandB run selected"}), 400

    if not project_name:
        return jsonify({"error": "No WandB project specified"}), 400

    try:
        model_config = fetch_wandb_model(run_id, project_name)
        visualization_data = process_visualization_data(model_config)
        return jsonify({"layers": visualization_data})
    except ValueError as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
