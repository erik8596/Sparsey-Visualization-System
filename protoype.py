import plotly.graph_objects as go
import numpy as np
import yaml

# Load Sparsey model configurations from YAML file
with open('/Users/erik/Desktop/SparseyTestingSystem/demo/example_configs/presentation_4_configs/network.yaml', 'r') as file:
    network_config = yaml.safe_load(file)

# Extract key parameters from the network configuration
input_dim = network_config.get('input_dim', 1)
layers_config = network_config.get('layers', [])

# Function to create a symmetrical mac_boundary
def mac_boundary(center_x, center_y, size=1):
    angles = np.linspace(0, 2 * np.pi, 7)
    x = center_x + size * np.cos(angles)
    y = center_y + size * np.sin(angles)
    return x, y

# Function to generate a hexagonal grid
def hex_grid(rows, cols, hex_size=1):
    mac_positions = []
    for row in range(rows):
        for col in range(cols):
            x = col * 1.5 * hex_size  # Horizontal spacing
            y = row * (np.sqrt(3) * hex_size)  # Vertical spacing
            if col % 2 == 1:  # Offset odd columns
                y += np.sqrt(3) * hex_size / 2
            mac_positions.append((x, y))
    return mac_positions

# Function to generate the centers of competitive modules (CMs) within a MAC
def cm_centers(center_x, center_y, size):
    """Generate centers for competitive modules (CMs) within the parent MAC."""
    angles = np.linspace(0, 2 * np.pi, 7, endpoint=False)
    centers = [(center_x, center_y)]  # Center CM
    for angle in angles:
        x = center_x + size * np.cos(angle)
        y = center_y + size * np.sin(angle)
        centers.append((x, y))
    return centers

# Function to generate vertices for a neuron
def neuron(center_x, center_y, radius, num_points=12):
    """Generate vertices for a flat neuron representation."""
    angles = np.linspace(0, 2 * np.pi, num_points)
    x = center_x + radius * np.cos(angles)
    y = center_y + radius * np.sin(angles)
    return list(x), list(y)

# Function to generate a smaller hexagonal grid for neurons within a CM
def neuron_centers(center_x, center_y, radius):
    """Generate 7 neuron centers in a small hexagonal pattern."""
    size = 2 * radius + 0.01  # Distance between centers equals the diameter
    angles = np.linspace(0, 2 * np.pi, 7, endpoint=False)
    centers = [(center_x, center_y)]  # Center neuron
    for angle in angles:
        x = center_x + size * np.cos(angle)
        y = center_y + size * np.sin(angle)
        centers.append((x, y))
    return centers

# Create the Plotly figure
fig = go.Figure()

# Define layers based on network configuration
layers = []
for idx, layer in enumerate(layers_config):
    layers.append({
        "z": idx * 5,
        "rows": layer['params'].get("mac_grid_num_rows", 1),
        "cols": layer['params'].get("mac_grid_num_cols", 1),
        "hex_size": 1,
        "center_x": 0,
        "center_y": 0,
        "num_cms_per_mac": layer['params'].get("num_cms_per_mac", 1),
        "num_neurons_per_cm": layer['params'].get("num_neurons_per_cm", 1)
    })

# Add layers to the figure
mac_positions_layers = []
for layer in layers:
    mac_positions = hex_grid(layer["rows"], layer["cols"], hex_size=layer["hex_size"])
    # Adjust positions to be centered around (0, 0)
    mac_positions = [(x - (layer["cols"] - 1) * 0.75 * layer["hex_size"], y - (layer["rows"] - 1) * (np.sqrt(3) * layer["hex_size"]) / 2) for x, y in mac_positions]
    mac_positions_layers.append((mac_positions, layer["z"]))
    for mac_x, mac_y in mac_positions:
        # Hexagon boundary representing the MAC
        hex_x, hex_y = mac_boundary(mac_x, mac_y, size=layer["hex_size"])
        fig.add_trace(go.Scatter3d(
            x=hex_x, y=hex_y, z=[layer["z"]] * len(hex_x), mode='lines', name='MAC',
            line=dict(color='blue')
        ))

        # Add competitive modules (CMs) within each MAC
        cm_centers_positions = cm_centers(mac_x, mac_y, size=layer["hex_size"] * 0.5)
        combined_x = []
        combined_y = []
        combined_z = []
        for cm_x, cm_y in cm_centers_positions:
            # Generate neurons within each CM
            radius = layer["hex_size"] * 0.06  # Radius of the neurons
            neuron_centers_positions = neuron_centers(cm_x, cm_y, radius)
            for neuron_x, neuron_y in neuron_centers_positions:
                neuron_x_vals, neuron_y_vals = neuron(neuron_x, neuron_y, radius=radius)
                combined_x.extend(neuron_x_vals + [None])  # Add None to separate each neuron
                combined_y.extend(neuron_y_vals + [None])
                combined_z.extend([layer["z"]] * len(neuron_x_vals) + [None])

        # Add all neurons as a single trace
        fig.add_trace(go.Scatter3d(
            x=combined_x,
            y=combined_y,
            z=combined_z,
            mode='lines',  # Render as hollow 2D neurons
            line=dict(color='black', width=2)  # Hollow neuron outline
        ))

# Add example connections
# for i in range(len(mac_positions_layers) - 1):
#     current_layer_positions, current_z = mac_positions_layers[i]
#     next_layer_positions, next_z = mac_positions_layers[i + 1]
#     # Top-down connections (from one layer to the one above)
#     for (x1, y1), (x2, y2) in zip(current_layer_positions, next_layer_positions):
#         fig.add_trace(go.Scatter3d(
#             x=[x1, x2],
#             y=[y1, y2],
#             z=[current_z, next_z],
#             mode='lines',
#             line=dict(color='green', width=2),
#             name='TopDown'
#         ))

# Horizontal connections within each layer
# for mac_positions, z in mac_positions_layers:
#     for (x1, y1), (x2, y2) in zip(mac_positions[:-1], mac_positions[1:]):
#         fig.add_trace(go.Scatter3d(
#             x=[x1, x2],
#             y=[y1, y2],
#             z=[z, z],
#             mode='lines',
#             line=dict(color='orange', width=2),
#             name='Horizontal'
#         ))

# Bottom-up connections (reverse of top-down)
# for i in range(1, len(mac_positions_layers)):
#     current_layer_positions, current_z = mac_positions_layers[i]
#     previous_layer_positions, previous_z = mac_positions_layers[i - 1]
#     for (x1, y1), (x2, y2) in zip(current_layer_positions, previous_layer_positions):
#         fig.add_trace(go.Scatter3d(
#             x=[x1, x2],
#             y=[y1, y2],
#             z=[current_z, previous_z],
#             mode='lines',
#             line=dict(color='red', width=2),
#             name='BottomUp'
#         ))

# Customize 3D layout for panning and rotating
fig.update_layout(
    scene=dict(
        xaxis=dict(visible=False),
        yaxis=dict(visible=False),
        zaxis=dict(visible=False),
    ),
    showlegend=False  # Hide legend for cleaner visuals
)

# Show plot with 3D interactivity
fig.show()