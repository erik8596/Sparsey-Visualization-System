import sys
from pathlib import Path
from flask import request, render_template
from app_factory import FlaskAppFactory
from config import DevelopmentConfig
from visualization_controller import VisualizationController

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

# Create Flask app
app = FlaskAppFactory.create_app(DevelopmentConfig)

# Initialize controller
controller = VisualizationController()

@app.route("/")
def index():
    """Serve the Three.js visualization page."""
    return render_template("index.html")

@app.route("/get_projects", methods=["GET"])
def get_projects_route():
    """Fetch available projects from WandB."""
    return controller.get_projects()

@app.route("/get_runs", methods=["POST"])
def get_runs_route():
    """Fetch runs within a specific project."""
    data = request.get_json()
    return controller.get_runs(data.get("project"))

@app.route("/visualize", methods=["POST"])
def visualize():
    """Visualize a specific run."""
    data = request.get_json()
    return controller.visualize_run(
        run_id=data.get("run_id"),
        project_name=data.get("project")
    )

if __name__ == "__main__":
    app.run(debug=True)
