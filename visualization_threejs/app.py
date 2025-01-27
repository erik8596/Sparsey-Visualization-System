import os
import sys
from flask import Flask, render_template, request, jsonify

# Add parent directory to access shared files
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from threejs_configs.threejs_prototype import initialize_threejs_svs
from config_loader import load_network_config

# Set path to YAML config directory
NETWORK_CONFIGS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'configs'))

app = Flask(__name__, template_folder='templates')

@app.route("/")
def index():
    """Serve the Three.js visualization page."""
    return render_template("index.html")

@app.route("/get_models")
def get_models():
    """List available YAML files."""
    models = [f for f in os.listdir(NETWORK_CONFIGS_DIR) if f.endswith(".yaml")]
    return jsonify(models)

@app.route("/visualize", methods=["POST"])
def visualize():
    """Load the YAML config and return visualization data for Three.js."""
    model_name = request.json.get("model")
    if not model_name:
        return jsonify({"error": "No model selected"}), 400

    model_path = os.path.join(NETWORK_CONFIGS_DIR, model_name)

    try:
        visualization_data = initialize_threejs_svs(model_path)
        return jsonify({"layers": visualization_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
