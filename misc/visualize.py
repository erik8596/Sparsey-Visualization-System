"""Flask implementation below. Uses separate windows for loading the config file and launching the rendering"""
# import sys
# from flask import Flask, render_template, request, jsonify
# from prototype import initialize_svs
# from config_loader import load_network_config

# # Flask app initialization
# app = Flask(__name__)

# # Path to the directory containing network models
# NETWORK_CONFIGS_DIR = "/Users/erik/Desktop/SparseyTestingSystem/demo/example_configs/presentation_configs"

# @app.route("/")
# def index():
#     """Home page with a dropdown menu for model selection."""
#     import os
#     model_files = [f for f in os.listdir(NETWORK_CONFIGS_DIR) if f.endswith(".yaml")]
#     return render_template("index.html", models=model_files)

# @app.route("/visualize", methods=["POST"])
# def visualize():
#     """Endpoint to launch the visualization."""
#     selected_model = request.form.get("model")
#     if not selected_model:
#         return jsonify({"error": "No model selected"}), 400

#     model_path = f"{NETWORK_CONFIGS_DIR}/{selected_model}"

#     try:
#         initialize_svs(model_path)
#         return jsonify({"message": "Visualization launched successfully"}), 200
#     except Exception as e:
#         return jsonify({"error": str(e)}), 500

# def start_flask():
#     """Start the Flask application."""
#     print("Starting Flask web server...")
#     app.run(debug=True)

# def main():
#     """Main function to handle CLI and Flask integration."""
#     if len(sys.argv) == 1:
#         # Default behavior: Start the Flask app
#         start_flask()
#     elif len(sys.argv) == 2:
#         # CLI mode: Visualize a specific configuration file
#         config_file_path = sys.argv[1]
#         print(f"Launching visualization with config: {config_file_path}")
#         try:
#             initialize_svs(config_file_path)
#         except Exception as e:
#             print(f"An error occurred: {e}")
#     else:
#         print("Usage:")
#         print("  python visualize.py          # Start Flask app")
#         print("  python visualize.py <config_file_path>  # Visualize a specific model via CLI")

# if __name__ == "__main__":
#     main()

"""Dash implementation below. Uses one window for loading the config file and dynamically launching the rendering"""
import dash
from dash import dcc, html
from dash.dependencies import Input, Output, State
import os
import yaml
from render_manager import RenderManager
from grid_utils import hex_grid, cm_centers, neuron_centers

# Path to the directory containing network models
NETWORK_CONFIGS_DIR = "/home/ryumakiguchi/code/ryumakiguchi/Sparsey/SparseyTestingSystem/demo/example_configs/presentation_4_configs"

# Initialize Dash app
app = dash.Dash(__name__)

# Global variable to store parsed YAML configurations
parsed_network_config = None

# Layout for Dash app
app.layout = html.Div([
    html.H1("Sparsey Visualization System"),

    # Dropdown to select the YAML configuration
    html.Label("Select Network Configuration:"),
    dcc.Dropdown(
        id='model-dropdown',
        options=[{'label': f, 'value': f} for f in os.listdir(NETWORK_CONFIGS_DIR) if f.endswith('.yaml')],
        placeholder="Select a network configuration",
        style={'width': '50%'}
    ),

    # Button to visualize
    html.Button('Visualize', id='visualize-button', n_clicks=0),

    # Graph to display the visualization
    dcc.Graph(id='sparsey-visualization', style={'height': '80vh'}),

    # Status message
    html.Div(id='status-message', style={'marginTop': '20px', 'color': 'green'})
])

# Callback to handle the visualization
@app.callback(
    [Output('sparsey-visualization', 'figure'),
     Output('status-message', 'children')],
    [Input('visualize-button', 'n_clicks')],
    [State('model-dropdown', 'value')]
)
def visualize_model(n_clicks, selected_model):
    if not selected_model:
        return {}, "Please select a network configuration."

    model_path = os.path.join(NETWORK_CONFIGS_DIR, selected_model)

    # Load and process the network configuration
    try:
        with open(model_path, 'r') as file:
            network_config = yaml.safe_load(file)
    except Exception as e:
        return {}, f"Error loading configuration: {e}"

    render_manager = RenderManager()

    try:
        layers_config = network_config.get('layers', [])
        if not layers_config:
            return {}, "No layers found in the configuration!"

        for idx, layer in enumerate(layers_config):
            rows = layer['params'].get('mac_grid_num_rows', 1)
            cols = layer['params'].get('mac_grid_num_cols', 1)
            num_cms = layer['params'].get('num_cms_per_mac', 1)
            num_neurons = layer['params'].get('num_neurons_per_cm', 1)

            # Generate MAC positions
            mac_positions = hex_grid(rows, cols)
            z = idx * 5  # Z offset for layers

            for mac_x, mac_y in mac_positions:
                render_manager.add_mac(mac_x, mac_y, z, size=1)

                # Generate CM positions within each MAC
                cm_positions = cm_centers(mac_x, mac_y, size=0.5, num_cms=num_cms)
                render_manager.add_cm(cm_positions, z, size=0.2)

                # Generate Neurons within each CM
                for cm_x, cm_y in cm_positions:
                    neuron_positions = neuron_centers(cm_x, cm_y, radius=0.05, num_neurons=num_neurons)
                    render_manager.add_neurons(neuron_positions, z, radius=0.05)

        # Return the figure
        return render_manager.fig, "Visualization rendered successfully!"

    except Exception as e:
        return {}, f"Error during visualization: {e}"

if __name__ == '__main__':
    app.run_server(debug=True)
